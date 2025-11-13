import { useState, useEffect } from 'react';
import { Download, CheckCircle2, AlertTriangle, Monitor, Apple, Terminal, Key, Trash2, Plus } from 'lucide-react';
import { apiClient } from '../api/client';
import { enrollmentTokensApi, type EnrollmentToken } from '../api/enrollmentTokens';

export function AgentDownload() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [tokens, setTokens] = useState<EnrollmentToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const tokensPerPage = 5;

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      const data = await enrollmentTokensApi.list();
      setTokens(data);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!tokenName.trim()) {
      alert('Please enter a token name');
      return;
    }

    setCreatingToken(true);
    try {
      const response = await enrollmentTokensApi.create({
        name: tokenName.trim(),
        expires_in_days: expiresInDays,
        max_uses: maxUses,
      });
      
      setNewToken(response.token);
      setTokenName('');
      setExpiresInDays(undefined);
      setMaxUses(undefined);
      setShowCreateForm(false);
      await loadTokens();
    } catch (error) {
      console.error('Failed to create token:', error);
      alert('Failed to create enrollment token. Please try again.');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this token?')) return;

    try {
      await enrollmentTokensApi.delete(id);
      await loadTokens();
    } catch (error) {
      console.error('Failed to delete token:', error);
      alert('Failed to revoke token. Please try again.');
    }
  };

  const handleDownload = async (platform: 'linux' | 'macos' | 'windows', token: string) => {
    setDownloading(platform);
    
    try {
      const response = await apiClient.get(`/endpoints/install/script/${platform}`, {
        params: { token },
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

  // Pagination logic
  const sortedTokens = [...tokens].sort((a, b) => b.id - a.id); // newest first
  const totalPages = Math.ceil(sortedTokens.length / tokensPerPage);
  const paginatedTokens = sortedTokens.slice(
    (currentPage - 1) * tokensPerPage,
    currentPage * tokensPerPage
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Download Agent</h1>
      <p className="text-gray-600 dark:text-[#f8f8f2] mb-8">
        Generate an enrollment token below, then download a pre-configured agent for your platform
      </p>
      
      {/* New Token Display - Show at top if exists */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Token Created Successfully!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                Copy this token now - it won't be shown again:
              </p>
              <div className="bg-white dark:bg-[#44475a] rounded p-3 font-mono text-sm break-all border border-green-300 dark:border-green-700">
                <code className="text-gray-800 dark:text-gray-200">{newToken}</code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  alert('Token copied to clipboard!');
                }}
                className="mt-2 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Platform Selection - MOVED TO TOP */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Choose Your Platform</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Generate Token
          </button>
        </div>
        
        {!newToken && (
          <p className="text-gray-600 dark:text-[#f8f8f2] mb-6">
            Generate an enrollment token above to download the pre-configured installer.
          </p>
        )}
        
        {/* Create Token Form */}
        {showCreateForm && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
                  Token Name *
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., Production Servers"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#44475a] text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
                  Expires In (days)
                </label>
                <input
                  type="number"
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Never"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#44475a] text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#f8f8f2] mb-1">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#44475a] text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateToken}
                disabled={creatingToken}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition disabled:opacity-50"
              >
                {creatingToken ? 'Creating...' : 'Create Token'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-[#44475a] dark:hover:bg-gray-600 text-gray-700 dark:text-[#f8f8f2] font-medium rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Linux */}
          <button
            onClick={() => newToken && handleDownload('linux', newToken)}
            disabled={!newToken || downloading === 'linux'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-[#6272a4] rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-[#44475a]"
          >
            <Terminal className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Linux</span>
            <span className="text-sm text-gray-600 dark:text-[#f8f8f2] text-center mb-3">
              Ubuntu, Debian, RHEL, Alpine
            </span>
            {downloading === 'linux' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#f8f8f2]">
                <Download className="w-4 h-4" />
                install-crontopus-agent.sh
              </div>
            )}
          </button>
          
          {/* macOS */}
          <button
            onClick={() => newToken && handleDownload('macos', newToken)}
            disabled={!newToken || downloading === 'macos'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-[#6272a4] rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-[#44475a]"
          >
            <Apple className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">macOS</span>
            <span className="text-sm text-gray-600 dark:text-[#f8f8f2] text-center mb-3">
              Intel & Apple Silicon
            </span>
            {downloading === 'macos' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#f8f8f2]">
                <Download className="w-4 h-4" />
                install-crontopus-agent.sh
              </div>
            )}
          </button>
          
          {/* Windows */}
          <button
            onClick={() => newToken && handleDownload('windows', newToken)}
            disabled={!newToken || downloading === 'windows'}
            className="flex flex-col items-center p-6 border-2 border-gray-200 dark:border-[#6272a4] rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-[#44475a]"
          >
            <Monitor className="w-12 h-12 mb-3 text-blue-500" />
            <span className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Windows</span>
            <span className="text-sm text-gray-600 dark:text-[#f8f8f2] text-center mb-3">
              Server 2019+, Win10/11
            </span>
            {downloading === 'windows' ? (
              <span className="text-sm text-blue-500">Downloading...</span>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-[#f8f8f2]">
                <Download className="w-4 h-4" />
                install-crontopus-agent.ps1
              </div>
            )}
          </button>
        </div>
      </div>
      
      {/* Enrollment Tokens Section - MOVED TO BOTTOM */}
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Enrollment Tokens</h2>
        </div>
        
        {/* Tokens List */}
        {loadingTokens ? (
          <div className="text-gray-600 dark:text-[#6272a4] text-center py-4">Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <div className="text-gray-600 dark:text-[#6272a4] text-center py-8">
            <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No enrollment tokens yet. Generate one to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-gray-200 dark:border-[#6272a4]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase">Used</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase">Expires</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase">Last Used</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-[#6272a4] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#6272a4]">
                  {paginatedTokens.map((token) => (
                    <tr key={token.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{token.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#6272a4]">
                        {token.used_count}{token.max_uses ? ` / ${token.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#6272a4]">
                        {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-[#6272a4]">
                        {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteToken(token.id)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-[#6272a4]">
                <div className="text-sm text-gray-600 dark:text-[#6272a4]">
                  Showing {(currentPage - 1) * tokensPerPage + 1} to {Math.min(currentPage * tokensPerPage, sortedTokens.length)} of {sortedTokens.length} tokens
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2]"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded ${
                          currentPage === page
                            ? 'bg-blue-500 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-[#f8f8f2]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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
      <div className="bg-white dark:bg-[#44475a] rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Installation Instructions</h2>
        
        <div className="space-y-4">
          {/* Linux/macOS */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 dark:text-[#f8f8f2] mb-2">
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
            <h3 className="font-semibold text-sm text-gray-700 dark:text-[#f8f8f2] mb-2">
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
        <p className="text-sm text-gray-600 dark:text-[#6272a4]">
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
