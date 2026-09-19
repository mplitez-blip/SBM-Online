const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const readline = require('readline');
function ask(rl, question, hidden = false) {
  if (!hidden) {
    return new Promise((resolve) => rl.question(question, resolve));
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let value = '';

    function onData(character) {
      if (character === '\u0003') {
        stdout.write('\n');
        process.exit(130);
      }

      if (character === '\r' || character === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(value);
        return;
      }

      if (character === '\u007f') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write('\b \b');
        }
        return;
      }

      value += character;
      stdout.write('*');
    }

    stdin.on('data', onData);
  });
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const username = (await ask(rl, 'Regional username: ')).trim();
  const fullName = (await ask(rl, 'Regional administrator name: ')).trim();
  const email = (await ask(rl, 'Email address, optional: ')).trim();

  rl.close();

  if (!username || !fullName) {
    throw new Error('Username and administrator name are required.');
  }

  const password = await ask(
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    }),
    'Password: ',
    true,
  );

  const confirmation = await ask(
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    }),
    'Confirm password: ',
    true,
  );

  if (password !== confirmation) {
    throw new Error('Passwords do not match.');
  }

  if (password.length < 12) {
    throw new Error('Password must contain at least 12 characters.');
  }

  const client = new Client({
    host: process.env.SQL_HOST,
    port: Number(process.env.SQL_PORT || 5432),
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
  });

  await client.connect();

  try {
    const existing = await client.query(
      `SELECT id
       FROM users
       WHERE username = $1
          OR ($2 <> '' AND email = $2)
       LIMIT 1`,
      [username, email],
    );

    if (existing.rowCount > 0) {
      throw new Error('A user with that username or email already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO users (
          username,
          email,
          password_hash,
          role,
          full_name,
          is_active,
          failed_attempts
       )
       VALUES ($1, NULLIF($2, ''), $3, 'regional', $4, true, 0)
       RETURNING id, username, email, role, full_name`,
      [username, email, passwordHash, fullName],
    );

    const created = inserted.rows[0];

    await client.query(
      `INSERT INTO audit_logs (
          user_id,
          username,
          role,
          action,
          resource_type,
          resource_id,
          details
       )
       VALUES ($1, $2, 'regional', 'CREATE_INITIAL_ADMIN',
               'User', $3, $4)`,
      [
        created.id,
        created.username,
        String(created.id),
        JSON.stringify({
          source: 'self-hosting CLI',
          accountRole: 'regional',
        }),
      ],
    );

    await client.query('COMMIT');

    console.log('');
    console.log('Regional administrator created successfully.');
    console.log(`User ID: ${created.id}`);
    console.log(`Username: ${created.username}`);
    console.log(`Role: ${created.role}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('');
  console.error(`Unable to create administrator: ${error.message}`);
  process.exit(1);
});
