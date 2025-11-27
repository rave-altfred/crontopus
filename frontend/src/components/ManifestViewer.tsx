import { useState } from 'react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Register YAML language
SyntaxHighlighter.registerLanguage('yaml', yaml);

interface ManifestViewerProps {
  content: string;
  fileName?: string;
}

export const ManifestViewer = ({ content, fileName }: ManifestViewerProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-[#282a36] rounded border border-gray-200 dark:border-[#44475a] overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-[#21222c] border-b border-gray-200 dark:border-[#44475a] flex justify-between items-center">
        <h3 className="text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">
          {fileName || 'JOB MANIFEST'}
        </h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-xs font-mono text-gray-600 dark:text-[#6272a4] hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {copied ? '✓ COPIED' : 'COPY'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language="yaml"
          style={dracula}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            backgroundColor: 'transparent', // Let parent container handle bg
            fontFamily: 'monospace'
          }}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: '#6272a4',
            textAlign: 'right'
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
