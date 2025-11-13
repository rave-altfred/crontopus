interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Logo = ({ size = 'md', className = '' }: LogoProps) => {
  const sizeClasses = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-[14px]',
  } as const;

  return (
    <pre
      className={`${sizeClasses[size]} leading-tight font-mono text-[#5fb97d] dark:text-[#5fb97d] ${className}`}
      style={{ fontFamily: 'Courier, monospace' }}
    >
{`╭────────────────────╮
│       ╭────╮     ○ │
│    ╭──╯ [] ╰──╮○ ○ │
│   ╰──╮ [][] ╭──╯   │
│      ╰──╮╭──╯      │
│        ╰╯╰╯        │
│ C R O N T O P U S™ │
╰────────────────────╯`}
    </pre>
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
