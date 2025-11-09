import { useState } from 'react';
import { Download, CheckCircle2, AlertTriangle, Monitor, Apple, Terminal } from 'lucide-react';
import { apiClient } from '../api/client';

export function AgentDownload() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (platform: 'linux' | 'macos' | 'windows') => {
    setDownloading(platform);
    
    try {
      const response = await apiClient.get(`/agents/install/script/${platform}`, {
        responseType: 'blob',
      });
      
      // Create download
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = platform === 'windows' 
        ? 'install-crontopus-agent.ps1' 
        : 'install-crontopus-agent.sh';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download installer. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Download Agent</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        Get started by downloading a pre-configured agent for your platform
      </p>
      
      {/* Platform Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Choose Your Platform</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          The installer is pre-configured with your credentials. No manual setup needed!
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Linux */}
          <button
            onClick={() => handleDownload('linux')}
            disabled={downloading === 'linux'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Terminal className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1">Linux</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
              Ubuntu, Debian, RHEL, Alpine
            </span>
            {downloading === 'linux' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Download className="w-4 h-4" />
                install-crontopus-agent.sh
              </div>
            )}
          </button>
          
          {/* macOS */}
          <button
            onClick={() => handleDownload('macos')}
            disabled={downloading === 'macos'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Apple className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1">macOS</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
              Intel & Apple Silicon
            </span>
            {downloading === 'macos' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Download className="w-4 h-4" />
                install-crontopus-agent.sh
              </div>
            )}
          </button>
          
          {/* Windows */}
          <button
            onClick={() => handleDownload('windows')}
            disabled={downloading === 'windows'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Monitor className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1">Windows</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
              Server 2019+, Win10/11
            </span>
            {downloading === 'windows' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Download className="w-4 h-4" />
                install-crontopus-agent.ps1
              </div>
            )}
          </button>
        </div>
      </div>
      
      {/* What Happens Next */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
              What happens after download?
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-200">
              <li>Run the downloaded script (requires admin/sudo privileges)</li>
              <li>Agent binary downloads and installs automatically</li>
              <li>Configuration file is created with your credentials pre-filled</li>
              <li>Agent enrolls with Crontopus and starts syncing jobs</li>
            </ol>
          </div>
        </div>
      </div>
      
      {/* Installation Commands */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Installation Instructions</h2>
        
        <div className="space-y-4">
          {/* Linux/macOS */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
              Linux / macOS
            </h3>
            <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 font-mono text-sm">
              <code className="text-gray-800 dark:text-gray-200">
                chmod +x install-crontopus-agent.sh
                <br />
                ./install-crontopus-agent.sh
              </code>
            </div>
          </div>
          
          {/* Windows */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
              Windows (PowerShell as Administrator)
            </h3>
            <div className="bg-gray-100 dark:bg-gray-900 rounded p-3 font-mono text-sm">
              <code className="text-gray-800 dark:text-gray-200">
                .\install-crontopus-agent.ps1
              </code>
            </div>
          </div>
        </div>
      </div>
      
      {/* Security Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Security Note
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              The downloaded script contains your enrollment credentials. Treat it like a password:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 mt-2 space-y-1">
              <li>Do not share it with others</li>
              <li>Do not commit it to version control</li>
              <li>Delete it after installation</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Help Links */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Need help? Check out the{' '}
          <a
            href="https://github.com/rave-altfred/crontopus/blob/main/agent/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            agent documentation
          </a>
          {' '}or{' '}
          <a
            href="https://github.com/rave-altfred/crontopus/blob/main/agent/docs/windows-server-testing.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Windows Server guide
          </a>
        </p>
      </div>
    </div>
  );
}
