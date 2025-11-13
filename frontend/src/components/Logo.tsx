interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  pixelWidth?: number; // Overrides size classes when provided
  className?: string;
}

export const Logo = ({ size = 'md', pixelWidth, className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-10',
    md: 'w-16',
    lg: 'w-80', // Larger default for marketing/login pages
  } as const;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="Crontopus Logo" 
        className={`${pixelWidth ? '' : sizeClasses[size]} h-auto max-w-full object-contain`}
        style={pixelWidth ? { width: `${pixelWidth}px` } : undefined}
      />
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
