import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { namespacesApi, type Namespace } from '../api/namespaces';
import { Folder, FolderOpen, Plus, Trash2, AlertCircle } from 'lucide-react';

export function Groups() {
  const navigate = useNavigate();
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newNamespaceName, setNewNamespaceName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingNamespace, setDeletingNamespace] = useState<string | null>(null);

  useEffect(() => {
    loadNamespaces();
  }, []);

  const loadNamespaces = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await namespacesApi.list();
      // Sort: discovered first, then default, then alphabetically
      const sorted = data.sort((a, b) => {
        if (a.name === 'discovered') return -1;
        if (b.name === 'discovered') return 1;
        if (a.name === 'default') return -1;
        if (b.name === 'default') return 1;
        return a.name.localeCompare(b.name);
      });
      setNamespaces(sorted);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      await namespacesApi.create({ name: newNamespaceName });
      setNewNamespaceName('');
      setShowCreateDialog(false);
      await loadNamespaces();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete group "${name}"? This will only work if the group is empty.`)) {
      return;
    }

    try {
      setDeletingNamespace(name);
      await namespacesApi.delete(name);
      await loadNamespaces();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete group');
    } finally {
      setDeletingNamespace(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-[#6272a4]">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono uppercase">Job Groups</h1>
          <p className="text-sm font-mono text-gray-600 dark:text-[#6272a4] mt-1">
            // Organize your jobs into logical groups
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold font-mono uppercase rounded-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Job Group
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-red-800 dark:text-red-200 font-mono text-sm">{error}</div>
        </div>
      )}

      {/* Namespaces List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {namespaces.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a]">
            <FolderOpen className="w-12 h-12 text-gray-400 dark:text-[#44475a] mx-auto mb-3" />
            <p className="text-gray-500 dark:text-[#6272a4] font-mono uppercase tracking-wide">No job groups yet</p>
            <p className="text-xs font-mono text-gray-400 dark:text-[#6272a4]/70 mt-1">
              Create your first job group to organize jobs
            </p>
          </div>
        ) : (
          namespaces.map((ns) => (
            <div
              key={ns.name}
              className={`bg-white dark:bg-[#282a36] p-4 transition-all group ${
                ns.name === 'discovered'
                  ? 'border-2 border-purple-400 dark:border-purple-600'
                  : 'border border-gray-200 dark:border-[#44475a] hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {ns.name === 'discovered' ? (
                      <FolderOpen className="w-6 h-6 text-purple-500 dark:text-purple-400" />
                    ) : ns.is_system ? (
                      <FolderOpen className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <Folder className="w-6 h-6 text-gray-400 dark:text-[#6272a4]" />
                    )}
                    <div>
                      <h3 className="text-lg font-mono font-bold text-gray-900 dark:text-white">
                        {ns.name === 'discovered' && '🔍 '}{ns.name}
                      </h3>
                      {ns.is_system && (
                        <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono uppercase border ${
                          ns.name === 'discovered'
                            ? 'border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300'
                            : 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300'
                        }`}>
                          {ns.name === 'discovered' ? 'Auto-discovered' : 'System'}
                        </span>
                      )}
                    </div>
                  </div>
                  {!ns.is_system && (
                    <button
                      onClick={() => handleDelete(ns.name)}
                      disabled={deletingNamespace === ns.name}
                      className="text-gray-400 hover:text-red-600 dark:text-[#6272a4] dark:hover:text-[#ff5555] transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-mono text-gray-500 dark:text-[#6272a4]">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{ns.job_count}</span> JOB{ns.job_count !== 1 ? 'S' : ''}
                  </p>
                  {ns.name === 'discovered' && (
                    <p className="text-xs font-mono text-purple-600 dark:text-purple-400 mt-2 border-l-2 border-purple-200 dark:border-purple-800 pl-2">
                      Jobs found by agents on endpoints that weren't created in Crontopus
                    </p>
                  )}
                  {ns.name === 'default' && (
                    <p className="text-xs font-mono text-gray-500 dark:text-[#6272a4] mt-2 border-l-2 border-gray-200 dark:border-[#44475a] pl-2">
                      Default group for new jobs
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#44475a]">
                  <button
                    onClick={() => navigate(`/jobs?namespace=${ns.name}`)}
                    className="w-full py-1.5 text-xs font-mono font-bold uppercase bg-gray-50 dark:bg-[#21222c] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] border border-gray-200 dark:border-[#44475a] transition-colors"
                  >
                    View Jobs
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#282a36] border border-gray-200 dark:border-[#44475a] p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 font-mono uppercase">
              Create New Job Group
            </h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold text-gray-500 dark:text-[#6272a4] mb-1 uppercase tracking-wider">
                  Job Group Name
                </label>
                <input
                  type="text"
                  value={newNamespaceName}
                  onChange={(e) => setNewNamespaceName(e.target.value)}
                  placeholder="e.g., backup, monitoring, team-platform"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#44475a] bg-white dark:bg-[#21222c] text-gray-900 dark:text-white font-mono text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                  pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
                  maxLength={63}
                  required
                  autoFocus
                />
                <p className="text-xs font-mono text-gray-500 dark:text-[#6272a4] mt-1">
                  Lowercase letters, numbers, and hyphens only. Must start and end with alphanumeric.
                </p>
              </div>

              {createError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-xs font-mono text-red-800 dark:text-red-200">{createError}</div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewNamespaceName('');
                    setCreateError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-[#44475a] hover:bg-gray-100 dark:hover:bg-[#44475a] text-gray-700 dark:text-[#f8f8f2] text-xs font-mono font-bold uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newNamespaceName}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
