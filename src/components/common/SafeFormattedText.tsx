import React from 'react';

interface SafeFormattedTextProps {
  text?: string | null;
  className?: string;
}

/**
 * Safe custom formatter that parses text into pure React elements.
 * Strictly supports only:
 * - **bold** (rendered as <strong className="fw-bold">)
 * - *italic* (rendered as <em className="fst-italic">)
 * - line breaks (\n) (rendered as separate block elements or <br />)
 *
 * Guaranteed XSS-free: Never uses dangerouslySetInnerHTML.
 * All text tokens are standard React text nodes.
 */
export const SafeFormattedText: React.FC<SafeFormattedTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split lines on newline
  const rawLines = text.split('\n');

  return (
    <div className={`safe-formatted-text ${className}`}>
      {rawLines.map((line, lineIndex) => {
        // Parse **bold** and *italic* within this single line
        const elements: React.ReactNode[] = [];
        let remaining = line;
        let tokenKey = 0;

        while (remaining.length > 0) {
          // Check for bold (**...**) and italic (*...*)
          const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
          const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/);

          // Determine which appears earlier
          const boldIndex = boldMatch ? remaining.indexOf(boldMatch[0]) : -1;
          const italicIndex = italicMatch ? remaining.indexOf(italicMatch[0]) : -1;

          if (boldIndex !== -1 && (italicIndex === -1 || boldIndex <= italicIndex)) {
            // Text before bold
            if (boldIndex > 0) {
              elements.push(remaining.substring(0, boldIndex));
            }
            // Bold element
            elements.push(
              <strong key={`b-${lineIndex}-${tokenKey++}`} className="fw-bold">
                {boldMatch![1]}
              </strong>
            );
            remaining = remaining.substring(boldIndex + boldMatch![0].length);
          } else if (italicIndex !== -1) {
            // Text before italic
            if (italicIndex > 0) {
              elements.push(remaining.substring(0, italicIndex));
            }
            // Italic element
            elements.push(
              <em key={`i-${lineIndex}-${tokenKey++}`} className="fst-italic">
                {italicMatch![1]}
              </em>
            );
            remaining = remaining.substring(italicIndex + italicMatch![0].length);
          } else {
            // No more formatting syntax, append remainder as plain text
            elements.push(remaining);
            break;
          }
        }

        return (
          <div key={`line-${lineIndex}`} className={lineIndex < rawLines.length - 1 ? 'mb-1' : ''}>
            {elements.length > 0 ? elements : <br />}
          </div>
        );
      })}
    </div>
  );
};

export default SafeFormattedText;
