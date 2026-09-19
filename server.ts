import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import authRoutes from './src/server/routes/authRoutes.ts';
import schoolYearRoutes from './src/server/routes/schoolYearRoutes.ts';
import formBuilderRoutes from './src/server/routes/formBuilderRoutes.ts';
import schoolRoutes from './src/server/routes/schoolRoutes.ts';
import divisionRoutes from './src/server/routes/divisionRoutes.ts';
import assessmentRoutes from './src/server/routes/assessmentRoutes.ts';
import monitoringRoutes from './src/server/routes/monitoringRoutes.ts';
import customizationRoutes from './src/server/routes/customizationRoutes.ts';
import exportRoutes from './src/server/routes/exportRoutes.ts';

const projectRoot = process.cwd();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const HOST =
    process.env.HOST ||
    (process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging'
      ? '127.0.0.1'
      : '0.0.0.0');

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error('PORT must be a valid integer between 1 and 65535.');
  }

  // Body parsing and cookies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Project SBM Online API', timestamp: new Date().toISOString() });
  });

  // API Route modules
  app.use('/api/auth', authRoutes);
  app.use('/api/school-years', schoolYearRoutes);
  app.use('/api/forms', formBuilderRoutes);
  app.use('/api/form-builder', formBuilderRoutes);
  app.use('/api/divisions', divisionRoutes);
  app.use('/api', schoolRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/customization', customizationRoutes);
  app.use('/api/export', exportRoutes);

  // Secure static uploads directory
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    next();
  }, express.static(uploadsDir, {
    dotfiles: 'ignore',
    fallthrough: false,
    maxAge: '1d',
  }));

  // Error handling middleware for API
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`[Project SBM Online] Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
