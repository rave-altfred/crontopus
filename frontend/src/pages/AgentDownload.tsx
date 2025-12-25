import { useState, useEffect } from 'react';
import { Download, CheckCircle2, Monitor, Apple, Terminal, Key, Trash2, Plus } from 'lucide-react';
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white font-mono uppercase">Download Agent</h1>
        <p className="text-sm font-mono text-gray-600 dark:text-[#f8f8f2]">
          // Generate an enrollment token, then download the agent for your platform.
        </p>
      </div>
      
      {/* New Token Display - Show at top if exists */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500 p-6 shadow-none">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-mono font-bold text-green-900 dark:text-green-100 mb-2 uppercase tracking-wide">
                Enrollment Token Generated
              </h3>
              <p className="text-sm font-mono text-green-800 dark:text-green-200 mb-3">
                WARNING: Copy this token now. It will not be shown again.
              </p>
              <div className="bg-white dark:bg-[#282a36] border border-green-200 dark:border-green-800 p-4 mb-3">
                <code className="text-gray-800 dark:text-[#f8f8f2] font-mono text-sm break-all">{newToken}</code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  alert('Token copied to clipboard!');
                }}
                className="text-xs font-mono font-bold uppercase text-green-600 dark:text-green-400 hover:underline"
              >
                Copy to clipboard
              </button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
            >
              <span className="font-mono text-xl">×</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Platform Selection */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono uppercase">Select Platform</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Token
          </button>
        </div>
        
        {!newToken && (
          <p className="text-sm font-mono text-gray-500 dark:text-[#6272a4] mb-6 bg-gray-50 dark:bg-[#21222c] p-3 border-l-2 border-gray-300 dark:border-[#44475a]">
            NOTE: You must generate an enrollment token before downloading the installer.
          </p>
        )}
        
        {/* Create Token Form */}
        {showCreateForm && (
          <div className="bg-gray-50 dark:bg-[#21222c] border-t border-b border-gray-200 dark:border-[#44475a] p-6 mb-6 -mx-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Token Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., PRODUCTION_SERVERS"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Expires In (days)
                </label>
                <input
                  type="number"
                  value={expiresInDays || ''}
                  onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="NEVER"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="UNLIMITED"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#282a36] text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateToken}
                disabled={creatingToken}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {creatingToken ? 'CREATING...' : 'CREATE TOKEN'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] font-mono text-xs font-bold uppercase tracking-wider transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Linux */}
          <button
            onClick={() => newToken && handleDownload('linux', newToken)}
            disabled={!newToken || downloading === 'linux'}
            className="group relative flex flex-col items-center p-6 border border-gray-200 dark:border-[#44475a] hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-[#282a36] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-[#44475a]"
          >
            <Terminal className="w-10 h-10 mb-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="font-mono font-bold text-lg mb-1 text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">LINUX</span>
            <span className="text-xs font-mono text-gray-500 dark:text-[#6272a4] text-center mb-4">
              Ubuntu, Debian, RHEL, Alpine
            </span>
            {downloading === 'linux' ? (
              <span className="text-xs font-mono text-blue-500 animate-pulse">DOWNLOADING...</span>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-600 dark:text-[#f8f8f2] group-hover:text-blue-500 transition-colors">
                <Download className="w-3 h-3" />
                DOWNLOAD SCRIPT
              </div>
            )}
          </button>
          
          {/* macOS */}
          <button
            onClick={() => newToken && handleDownload('macos', newToken)}
            disabled={!newToken || downloading === 'macos'}
            className="group relative flex flex-col items-center p-6 border border-gray-200 dark:border-[#44475a] hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-[#282a36] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-[#44475a]"
          >
            <Apple className="w-10 h-10 mb-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="font-mono font-bold text-lg mb-1 text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">MACOS</span>
            <span className="text-xs font-mono text-gray-500 dark:text-[#6272a4] text-center mb-4">
              Intel & Apple Silicon
            </span>
            {downloading === 'macos' ? (
              <span className="text-xs font-mono text-blue-500 animate-pulse">DOWNLOADING...</span>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-600 dark:text-[#f8f8f2] group-hover:text-blue-500 transition-colors">
                <Download className="w-3 h-3" />
                DOWNLOAD SCRIPT
              </div>
            )}
          </button>
          
          {/* Windows */}
          <button
            onClick={() => newToken && handleDownload('windows', newToken)}
            disabled={!newToken || downloading === 'windows'}
            className="group relative flex flex-col items-center p-6 border border-gray-200 dark:border-[#44475a] hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-[#282a36] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 dark:disabled:hover:border-[#44475a]"
          >
            <Monitor className="w-10 h-10 mb-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="font-mono font-bold text-lg mb-1 text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">WINDOWS</span>
            <span className="text-xs font-mono text-gray-500 dark:text-[#6272a4] text-center mb-4">
              Server 2019+, Win10/11
            </span>
            {downloading === 'windows' ? (
              <span className="text-xs font-mono text-blue-500 animate-pulse">DOWNLOADING...</span>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-600 dark:text-[#f8f8f2] group-hover:text-blue-500 transition-colors">
                <Download className="w-3 h-3" />
                DOWNLOAD SCRIPT
              </div>
            )}
          </button>
        </div>
      </div>
      
      {/* Enrollment Tokens Section */}
      <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[#44475a] flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white font-mono uppercase">Enrollment Tokens</h2>
        </div>
        
        {/* Tokens List */}
        {loadingTokens ? (
          <div className="text-gray-600 dark:text-[#6272a4] text-center py-8 font-mono text-sm">LOADING TOKENS...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-[#44475a]" />
            <p className="text-gray-600 dark:text-[#6272a4] font-mono text-sm">NO ACTIVE TOKENS FOUND</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-[#21222c] border-b border-gray-200 dark:border-[#44475a]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Usage</th>
                    <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Last Used</th>
                    <th className="px-6 py-3 text-left text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#44475a]">
                  {paginatedTokens.map((token) => (
                    <tr key={token.id} className="hover:bg-gray-50 dark:hover:bg-[#21222c] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900 dark:text-white">{token.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-[#6272a4]">
                        {token.used_count}{token.max_uses ? ` / ${token.max_uses}` : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-[#6272a4]">
                        {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : 'NEVER'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-[#6272a4]">
                        {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : 'NEVER'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteToken(token.id)}
                          className="text-gray-400 hover:text-red-600 dark:text-[#6272a4] dark:hover:text-[#ff5555] transition-colors"
                          title="Revoke token"
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
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-[#44475a]">
                <div className="text-xs font-mono text-gray-600 dark:text-[#6272a4]">
                  SHOWING {(currentPage - 1) * tokensPerPage + 1}-{Math.min(currentPage * tokensPerPage, sortedTokens.length)} OF {sortedTokens.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2] text-xs font-mono uppercase"
                  >
                    Prev
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-[#f8f8f2] text-xs font-mono uppercase"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Installation Commands */}
      <div className="bg-gray-900 dark:bg-[#21222c] border border-gray-800 dark:border-[#44475a] p-6">
        <h2 className="text-lg font-bold mb-4 text-white font-mono uppercase flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          Installation Instructions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Linux/macOS */}
          <div>
            <h3 className="font-mono font-bold text-xs text-gray-400 mb-2 uppercase tracking-wider">
              Linux / macOS (Bash)
            </h3>
            <div className="bg-black dark:bg-[#191a21] border border-gray-800 dark:border-[#44475a] p-4 font-mono text-sm text-gray-300 rounded">
              <div className="text-gray-500"># Make executable and run</div>
              <div className="mt-1">chmod +x install-crontopus-agent.sh</div>
              <div className="mt-1">./install-crontopus-agent.sh</div>
            </div>
          </div>
          
          {/* Windows */}
          <div>
            <h3 className="font-mono font-bold text-xs text-gray-400 mb-2 uppercase tracking-wider">
              Windows (PowerShell Admin)
            </h3>
            <div className="bg-black dark:bg-[#191a21] border border-gray-800 dark:border-[#44475a] p-4 font-mono text-sm text-gray-300 rounded">
              <div className="text-gray-500"># Run installer script</div>
              <div className="mt-1">.\install-crontopus-agent.ps1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
