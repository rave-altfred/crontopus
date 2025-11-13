import { useState, useEffect } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean; // Enable typing animation
  className?: string;
}

const LOGO_TEXT = `╭────────────────────╮
│       ╭────╮     ○ │
│    ╭──╯ [] ╰──╮○ ○ │
│   ╰──╮ [][] ╭──╯   │
│      ╰──╮╭──╯      │
│        ╰╯╰╯        │
│ C R O N T O P U S™ │
╰────────────────────╯`;

export const Logo = ({ size = 'md', animated = false, className = '' }: LogoProps) => {
  const [displayText, setDisplayText] = useState(animated ? '' : LOGO_TEXT);
  const [showCursor, setShowCursor] = useState(animated);
  const [isTyping, setIsTyping] = useState(animated);

  const sizeClasses = {
    sm: 'text-[12px]',
    md: 'text-[14px]',
    lg: 'text-[18px]',
  } as const;

  useEffect(() => {
    if (!animated) return;

    // Initial cursor blink for 1 second
    const blinkTimeout = setTimeout(() => {
      setIsTyping(true);
      
      // Type out the logo
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex <= LOGO_TEXT.length) {
          setDisplayText(LOGO_TEXT.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setShowCursor(false);
          setIsTyping(false);
        }
      }, 15); // Fast typing speed

      return () => clearInterval(typingInterval);
    }, 1000);

    return () => clearTimeout(blinkTimeout);
  }, [animated]);

  // Cursor blink effect
  useEffect(() => {
    if (!showCursor || !isTyping) return;

    const blinkInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => clearInterval(blinkInterval);
  }, [showCursor, isTyping]);

  return (
    <div className="relative inline-block">
      <pre
        className={`${sizeClasses[size]} leading-tight font-mono text-[#5fb97d] dark:text-[#5fb97d] ${className}`}
        style={{ fontFamily: 'Courier, monospace' }}
      >
        {displayText}
        {animated && !isTyping && showCursor && (
          <span className="animate-pulse">█</span>
        )}
      </pre>
      {animated && isTyping && showCursor && (
        <span 
          className={`${sizeClasses[size]} absolute font-mono text-[#5fb97d] dark:text-[#5fb97d] animate-pulse`}
          style={{ 
            fontFamily: 'Courier, monospace',
            bottom: '0',
            left: `${displayText.length > 0 ? 'auto' : '0'}`,
          }}
        >
          █
        </span>
      )}
    </div>
  );
};

// ASCII art logo for CLI/terminal
export const ASCII_LOGO = `
╭────────────────────╮
│       ╭────╮     ○ │
│    ╭──╯ [] ╰──╮○ ○ │
│   ╰──╮ [][] ╭──╯   │
│      ╰──╮╭──╯      │
│        ╰╯╰╯        │
│ C R O N T O P U S™ │
╰────────────────────╯
`;
