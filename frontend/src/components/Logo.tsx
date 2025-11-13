interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const Logo = ({ size = 'md', showText = true, className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-64 h-64', // Much larger for login/register pages
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="Crontopus Logo" 
        className={`${sizeClasses[size]} object-contain`}
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
