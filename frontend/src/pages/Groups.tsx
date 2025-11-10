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
      setNamespaces(data);
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
        <div className="text-gray-500 dark:text-gray-400">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Groups</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Organize your jobs into groups
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Group
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-red-800 dark:text-red-200">{error}</div>
        </div>
      )}

      {/* Namespaces List */}
      <div className="space-y-3">
        {namespaces.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No groups yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Create your first group to organize jobs
            </p>
          </div>
        ) : (
          namespaces.map((ns) => (
            <div
              key={ns.name}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {ns.is_system ? (
                    <FolderOpen className="w-6 h-6 text-blue-500" />
                  ) : (
                    <Folder className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {ns.name}
                      </h3>
                      {ns.is_system && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                          System
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {ns.job_count} {ns.job_count === 1 ? 'job' : 'jobs'}
                      {ns.name === 'discovered' && ' · Auto-populated by agent discovery'}
                      {ns.name === 'default' && ' · Default group for new jobs'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/jobs?namespace=${ns.name}`)}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                  >
                    View Jobs
                  </button>
                  {!ns.is_system && (
                    <button
                      onClick={() => handleDelete(ns.name)}
                      disabled={deletingNamespace === ns.name}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                      title="Delete group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create New Group
            </h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newNamespaceName}
                  onChange={(e) => setNewNamespaceName(e.target.value)}
                  placeholder="e.g., backup, monitoring, team-platform"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
                  maxLength={63}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lowercase letters, numbers, and hyphens only. Must start and end with alphanumeric.
                </p>
              </div>

              {createError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">{createError}</div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewNamespaceName('');
                    setCreateError(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newNamespaceName}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
