import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Check, Trash2, ChevronLeft, X, Pencil, ChevronDown, ListChecks, Star } from 'lucide-react';
import { supabase } from './supabase';
import Auth from './Auth';

const LAST_LIST_KEY = 'lists.lastListId';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [data, setData] = useState({ lists: [], tasks: {}, currentListId: null });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [newTaskText, setNewTaskText] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [editingListId, setEditingListId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [confirmDeleteList, setConfirmDeleteList] = useState(null);
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);

  const taskInputRef = useRef(null);

  // ============ Auth setup ============
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ============ Responsive ============
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = () => setIsDesktop(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ============ Data loading ============
  const loadData = useCallback(async () => {
    if (!user) return;
    const { data: lists, error } = await supabase
      .from('lists')
      .select('*, tasks(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
      return;
    }

    const tasksObj = {};
    const listsArr = (lists || []).map(({ tasks, ...list }) => {
      tasksObj[list.id] = (tasks || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      return list;
    });

    const savedListId = localStorage.getItem(LAST_LIST_KEY);
    const currentListId =
      (savedListId && listsArr.find(l => l.id === savedListId) ? savedListId : null) ||
      listsArr[0]?.id ||
      null;

    setData({ lists: listsArr, tasks: tasksObj, currentListId });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      loadData();
    } else {
      setData({ lists: [], tasks: {}, currentListId: null });
      setLoading(false);
    }
  }, [user, loadData]);

  // Refresh data when the tab regains focus (cheap cross-device sync)
  useEffect(() => {
    const handleFocus = () => {
      if (user && !document.hidden) loadData();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user, loadData]);

  // Persist currentListId locally so you return to the same list
  useEffect(() => {
    if (data.currentListId) {
      localStorage.setItem(LAST_LIST_KEY, data.currentListId);
    }
  }, [data.currentListId]);

  // ============ List actions ============
  const createList = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setAddingList(false);
      setNewListName('');
      return;
    }
    if (!user) return;

    const { data: newList, error } = await supabase
      .from('lists')
      .insert({ user_id: user.id, name: trimmed })
      .select()
      .single();

    if (error) {
      alert('Could not create list: ' + error.message);
      return;
    }

    setData(prev => ({
      lists: [...prev.lists, newList],
      tasks: { ...prev.tasks, [newList.id]: [] },
      currentListId: newList.id
    }));
    setAddingList(false);
    setNewListName('');
    setSidebarOpen(false);
    setTimeout(() => taskInputRef.current?.focus(), 120);
  };

  const renameList = async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEditingListId(null);
      setEditingName('');
      return;
    }
    const previous = data.lists.find(l => l.id === id);
    setData(prev => ({
      ...prev,
      lists: prev.lists.map(l => (l.id === id ? { ...l, name: trimmed } : l))
    }));
    setEditingListId(null);
    setEditingName('');

    const { error } = await supabase.from('lists').update({ name: trimmed }).eq('id', id);
    if (error) {
      // Revert
      setData(prev => ({
        ...prev,
        lists: prev.lists.map(l => (l.id === id ? previous : l))
      }));
      alert('Could not rename list: ' + error.message);
    }
  };

  const deleteList = async (id) => {
    const previousLists = data.lists;
    const previousTasks = data.tasks;
    const newLists = data.lists.filter(l => l.id !== id);
    const newTasks = { ...data.tasks };
    delete newTasks[id];

    setData({
      lists: newLists,
      tasks: newTasks,
      currentListId: data.currentListId === id ? (newLists[0]?.id ?? null) : data.currentListId
    });
    setConfirmDeleteList(null);

    const { error } = await supabase.from('lists').delete().eq('id', id);
    if (error) {
      // Revert
      setData(prev => ({ ...prev, lists: previousLists, tasks: previousTasks }));
      alert('Could not delete list: ' + error.message);
    }
  };

  const selectList = (id) => {
    setData(prev => ({ ...prev, currentListId: id }));
    setSidebarOpen(false);
  };

  // ============ Task actions ============
  const addTask = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || !data.currentListId || !user) return;

    const listId = data.currentListId;
    setNewTaskText('');

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        list_id: listId,
        text: trimmed,
        done: false,
        starred: false
      })
      .select()
      .single();

    if (error) {
      alert('Could not add task: ' + error.message);
      setNewTaskText(trimmed);
      return;
    }

    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: [...(prev.tasks[listId] || []), newTask]
      }
    }));
  };

  const toggleTask = async (taskId) => {
    if (!data.currentListId) return;
    const listId = data.currentListId;
    const task = (data.tasks[listId] || []).find(t => t.id === taskId);
    if (!task) return;

    const newDone = !task.done;
    const newDoneAt = newDone ? new Date().toISOString() : null;

    // Optimistic
    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: prev.tasks[listId].map(t =>
          t.id === taskId ? { ...t, done: newDone, done_at: newDoneAt } : t
        )
      }
    }));

    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone, done_at: newDoneAt })
      .eq('id', taskId);

    if (error) {
      // Revert
      setData(prev => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [listId]: prev.tasks[listId].map(t =>
            t.id === taskId ? { ...t, done: task.done, done_at: task.done_at } : t
          )
        }
      }));
      console.error('Could not update task:', error);
    }
  };

  const toggleStar = async (taskId) => {
    if (!data.currentListId) return;
    const listId = data.currentListId;
    const task = (data.tasks[listId] || []).find(t => t.id === taskId);
    if (!task) return;

    const newStarred = !task.starred;

    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: prev.tasks[listId].map(t =>
          t.id === taskId ? { ...t, starred: newStarred } : t
        )
      }
    }));

    const { error } = await supabase
      .from('tasks')
      .update({ starred: newStarred })
      .eq('id', taskId);

    if (error) {
      setData(prev => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [listId]: prev.tasks[listId].map(t =>
            t.id === taskId ? { ...t, starred: task.starred } : t
          )
        }
      }));
      console.error('Could not star task:', error);
    }
  };

  const startEditTask = (taskId, currentText) => {
    setEditingTaskId(taskId);
    setEditingTaskText(currentText);
  };

  const saveEditTask = async () => {
    const trimmed = editingTaskText.trim();
    const taskId = editingTaskId;
    if (!trimmed || !data.currentListId || !taskId) {
      setEditingTaskId(null);
      setEditingTaskText('');
      return;
    }
    const listId = data.currentListId;
    const task = (data.tasks[listId] || []).find(t => t.id === taskId);
    if (!task) {
      setEditingTaskId(null);
      setEditingTaskText('');
      return;
    }

    const previousText = task.text;

    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: prev.tasks[listId].map(t =>
          t.id === taskId ? { ...t, text: trimmed } : t
        )
      }
    }));
    setEditingTaskId(null);
    setEditingTaskText('');

    const { error } = await supabase
      .from('tasks')
      .update({ text: trimmed })
      .eq('id', taskId);

    if (error) {
      setData(prev => ({
        ...prev,
        tasks: {
          ...prev.tasks,
          [listId]: prev.tasks[listId].map(t =>
            t.id === taskId ? { ...t, text: previousText } : t
          )
        }
      }));
      alert('Could not save task: ' + error.message);
    }
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const deleteTask = async (taskId) => {
    if (!data.currentListId) return;
    const listId = data.currentListId;
    const previous = data.tasks[listId] || [];

    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: prev.tasks[listId].filter(t => t.id !== taskId)
      }
    }));

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      setData(prev => ({
        ...prev,
        tasks: { ...prev.tasks, [listId]: previous }
      }));
      alert('Could not delete task: ' + error.message);
    }
  };

  const clearCompleted = async () => {
    if (!data.currentListId) return;
    const listId = data.currentListId;
    const previous = data.tasks[listId] || [];
    const idsToDelete = previous.filter(t => t.done).map(t => t.id);

    setData(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [listId]: prev.tasks[listId].filter(t => !t.done)
      }
    }));
    setConfirmClearCompleted(false);

    if (idsToDelete.length === 0) return;

    const { error } = await supabase.from('tasks').delete().in('id', idsToDelete);
    if (error) {
      setData(prev => ({
        ...prev,
        tasks: { ...prev.tasks, [listId]: previous }
      }));
      alert('Could not clear completed tasks: ' + error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ============ Derived ============
  const currentList = data.lists.find(l => l.id === data.currentListId);
  const currentTasks = data.currentListId ? (data.tasks[data.currentListId] || []) : [];
  const incompleteTasks = currentTasks
    .filter(t => !t.done)
    .sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  const completedTasks = currentTasks
    .filter(t => t.done)
    .sort((a, b) => new Date(b.done_at || 0) - new Date(a.done_at || 0));
  const incompleteCountFor = (listId) =>
    (data.tasks[listId] || []).filter(t => !t.done).length;

  // ============ Render ============
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <div className="text-faint text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-app">
        <div className="text-faint text-sm">Loading your lists...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-app text-ink overflow-hidden">
      {/* Mobile drawer overlay */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {(isDesktop || sidebarOpen) && (
        <aside
          className={`
            w-72 shrink-0 bg-app border-r border-warm flex flex-col
            ${!isDesktop ? 'fixed inset-y-0 left-0 z-40 shadow-2xl fade-in' : ''}
          `}
        >
          <div className="px-6 pt-6 pb-4 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-medium italic text-ink">Lists</span>
              <span className="text-faint text-sm tabular-nums">·{data.lists.length}</span>
            </div>
            {!isDesktop && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 hover-warm rounded-md text-muted"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-thin">
            {data.lists.map(list => {
              const count = incompleteCountFor(list.id);
              const isActive = list.id === data.currentListId;
              const isEditingThisList = editingListId === list.id;

              if (isEditingThisList) {
                return (
                  <div key={list.id} className="mb-0.5 px-2 py-1">
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => renameList(list.id, editingName)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameList(list.id, editingName);
                        if (e.key === 'Escape') {
                          setEditingListId(null);
                          setEditingName('');
                        }
                      }}
                      autoFocus
                      className="w-full bg-surface border border-warmer rounded-md px-2.5 py-1.5 text-sm text-ink"
                    />
                  </div>
                );
              }

              return (
                <div key={list.id} className="group relative mb-0.5">
                  <button
                    onClick={() => selectList(list.id)}
                    className={`
                      w-full text-left pl-3 pr-20 py-2 rounded-lg flex items-center justify-between gap-2
                      transition-colors duration-150
                      ${isActive ? 'bg-ink text-active' : 'text-ink hover-warm'}
                    `}
                  >
                    <span className="truncate text-sm font-medium">{list.name}</span>
                    {count > 0 && (
                      <span className={`text-xs tabular-nums shrink-0 ml-auto ${isActive ? 'text-faint' : 'text-muted'}`}>
                        {count}
                      </span>
                    )}
                  </button>

                  <div className={`
                    absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 transition-opacity
                    ${isDesktop ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
                  `}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingListId(list.id);
                        setEditingName(list.name);
                      }}
                      className={`p-1.5 rounded transition-colors ${isActive ? 'hover:bg-white/10 text-faint hover:text-active' : 'hover:bg-black/5 text-muted hover:text-ink'}`}
                      aria-label="Rename list"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteList(list.id);
                      }}
                      className={`p-1.5 rounded transition-colors ${isActive ? 'hover:bg-white/10 text-faint hover:text-active' : 'hover:bg-black/5 text-muted hover:text-ink'}`}
                      aria-label="Delete list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {addingList ? (
              <div className="mt-1 px-2 py-1">
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onBlur={() => createList(newListName)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createList(newListName);
                    if (e.key === 'Escape') {
                      setAddingList(false);
                      setNewListName('');
                    }
                  }}
                  placeholder="Name this list"
                  autoFocus
                  className="w-full bg-surface border border-warmer rounded-md px-2.5 py-1.5 text-sm text-ink"
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingList(true)}
                className="mt-1 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted hover-warm hover:text-ink transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                New list
              </button>
            )}
          </nav>

          <div className="px-5 py-3 border-t border-warm flex items-center justify-between text-xs">
            <span className="text-faint truncate" title={user.email}>{user.email}</span>
            <button
              onClick={signOut}
              className="text-faint hover:text-ink transition-colors ml-2 shrink-0"
            >
              Sign out
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        <header className="border-b border-warm px-5 md:px-12 py-4 md:py-6 shrink-0">
          {!isDesktop && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-1 -ml-1 mb-1.5 px-1.5 py-1 text-xs font-medium uppercase tracking-wider text-muted hover:text-ink hover-warm rounded transition-colors"
              aria-label="Show all lists"
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
              All lists
            </button>
          )}
          <div className="flex items-center gap-3">
            {currentList ? (
              <div className="flex items-baseline gap-3 min-w-0">
                <h1 className="font-display text-2xl md:text-3xl font-medium tracking-tight text-ink truncate">
                  {currentList.name}
                </h1>
                <span className="text-sm text-muted tabular-nums shrink-0">
                  {incompleteTasks.length === 0 && currentTasks.length > 0
                    ? 'all done'
                    : `${incompleteTasks.length} ${incompleteTasks.length === 1 ? 'task' : 'tasks'}`}
                </span>
              </div>
            ) : (
              <h1 className="font-display text-2xl md:text-3xl font-medium tracking-tight italic text-muted">
                No list
              </h1>
            )}
          </div>
        </header>

        {currentList ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="max-w-2xl mx-auto px-5 md:px-12 py-6 md:py-10">
              <div className="mb-8">
                <div className="flex gap-3 items-center bg-app rounded-2xl border border-warm px-4 py-3.5 focus-within:border-warmer transition-all">
                  <Plus className="w-5 h-5 text-muted shrink-0" strokeWidth={2} />
                  <input
                    ref={taskInputRef}
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTask(newTaskText); }}
                    placeholder="Add a task and press enter"
                    className="flex-1 bg-transparent text-ink text-[15px]"
                  />
                </div>
              </div>

              {currentTasks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="font-display italic text-2xl text-faint mb-2">empty</div>
                  <div className="text-sm text-muted">Type above to add your first task.</div>
                </div>
              ) : (
                <>
                  {incompleteTasks.length > 0 ? (
                    <ul className="space-y-0.5">
                      {incompleteTasks.map(task => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          isDesktop={isDesktop}
                          isEditing={editingTaskId === task.id}
                          editingText={editingTaskText}
                          onToggle={() => toggleTask(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          onStartEdit={() => startEditTask(task.id, task.text)}
                          onEditChange={setEditingTaskText}
                          onEditSave={saveEditTask}
                          onEditCancel={cancelEditTask}
                          onToggleStar={() => toggleStar(task.id)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-10">
                      <div className="font-display italic text-2xl text-ink mb-1">all done</div>
                      <div className="text-sm text-muted">Nice work.</div>
                    </div>
                  )}

                  {completedTasks.length > 0 && (
                    <div className="mt-10">
                      <div className="flex items-center justify-between mb-2 px-3">
                        <button
                          onClick={() => setShowCompleted(!showCompleted)}
                          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted hover:text-ink transition-colors py-1"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${showCompleted ? '' : '-rotate-90'}`}
                            strokeWidth={2.5}
                          />
                          Completed · {completedTasks.length}
                        </button>
                        {showCompleted && (
                          <button
                            onClick={() => setConfirmClearCompleted(true)}
                            className="text-xs text-faint hover:text-ink transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {showCompleted && (
                        <ul className="space-y-0.5">
                          {completedTasks.map(task => (
                            <TaskItem
                              key={task.id}
                              task={task}
                              isDesktop={isDesktop}
                              isEditing={editingTaskId === task.id}
                              editingText={editingTaskText}
                              onToggle={() => toggleTask(task.id)}
                              onDelete={() => deleteTask(task.id)}
                              onStartEdit={() => startEditTask(task.id, task.text)}
                              onEditChange={setEditingTaskText}
                              onEditSave={saveEditTask}
                              onEditCancel={cancelEditTask}
                              onToggleStar={() => toggleStar(task.id)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-app border border-warm flex items-center justify-center mb-5">
                <ListChecks className="w-6 h-6 text-muted" strokeWidth={1.75} />
              </div>
              <h2 className="font-display text-2xl font-medium text-ink mb-1.5">Start a list</h2>
              <p className="text-sm text-muted mb-6">Create your first list to begin organizing tasks. Everything saves automatically.</p>
              <button
                onClick={() => { setSidebarOpen(true); setAddingList(true); }}
                className="inline-flex items-center gap-1.5 bg-ink text-active text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                New list
              </button>
            </div>
          </div>
        )}
      </main>

      {confirmDeleteList && (
        <ConfirmDialog
          title="Delete this list?"
          body={`"${data.lists.find(l => l.id === confirmDeleteList)?.name}" and its ${(data.tasks[confirmDeleteList] || []).length} ${(data.tasks[confirmDeleteList] || []).length === 1 ? 'task' : 'tasks'} will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteList(confirmDeleteList)}
          onCancel={() => setConfirmDeleteList(null)}
        />
      )}

      {confirmClearCompleted && (
        <ConfirmDialog
          title="Clear completed tasks?"
          body={`${completedTasks.length} completed ${completedTasks.length === 1 ? 'task' : 'tasks'} will be removed from this list.`}
          confirmLabel="Clear"
          danger
          onConfirm={clearCompleted}
          onCancel={() => setConfirmClearCompleted(false)}
        />
      )}
    </div>
  );
}

function TaskItem({
  task,
  isDesktop,
  isEditing,
  editingText,
  onToggle,
  onDelete,
  onStartEdit,
  onEditChange,
  onEditSave,
  onEditCancel,
  onToggleStar
}) {
  return (
    <li className="group flex items-center gap-2 px-3 py-2.5 rounded-lg hover-warm transition-colors">
      <button
        onClick={onToggle}
        className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150
          ${task.done ? 'bg-ink border-warmer' : 'border-warmer hover:border-ink'}
        `}
        style={task.done ? { backgroundColor: '#1A1714', borderColor: '#1A1714' } : {}}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6L5 8.5L10 3.5" className="check-tick" />
          </svg>
        )}
      </button>

      {isEditing ? (
        <input
          value={editingText}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onEditSave();
            if (e.key === 'Escape') onEditCancel();
          }}
          autoFocus
          className="flex-1 text-[15px] bg-app rounded px-2 py-0.5 -my-0.5 text-ink border border-warmer"
          style={{ minWidth: 0 }}
        />
      ) : (
        <span
          onClick={() => !task.done && onStartEdit()}
          className={`
            flex-1 text-[15px] break-words leading-snug py-0.5
            ${task.done ? 'text-faint line-through cursor-default' : 'text-ink cursor-text'}
          `}
        >
          {task.text}
        </span>
      )}

      {!isEditing && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggleStar}
            className="p-1.5 hover:bg-black/5 rounded-md transition-colors"
            aria-label={task.starred ? 'Unstar task' : 'Star task'}
          >
            <Star
              className="w-4 h-4"
              fill={task.starred ? '#D4923A' : 'none'}
              stroke={task.starred ? '#D4923A' : '#B5AE9D'}
              strokeWidth={1.75}
            />
          </button>
          <button
            onClick={onDelete}
            className={`
              p-1.5 hover:bg-black/5 rounded-md text-faint hover:text-ink transition-all
              ${isDesktop ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
            `}
            aria-label="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4 fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-medium text-ink mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">{body}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-ink rounded-lg hover-warm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium rounded-lg text-active transition-colors"
            style={{ backgroundColor: danger ? '#A03A2C' : '#1A1714' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
