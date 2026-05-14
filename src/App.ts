import { ProjectStorage } from './api/projectStorage';
import { StoryStatus } from './models/Story';
import { StoryStorage } from './api/storyStorage';
import { Task, TaskStatus } from './models/Task';
import { TaskStorage } from './api/taskStorage';
import { UserService } from './api/userService';
import { NotificationStorage } from './api/notificationStorage';
import { el } from './ui/dom';
import { buildTeamSection } from './screens/teamSection';
import { UsersScreen } from './screens/usersScreen';
import { NotificationCenter } from './screens/notificationCenter';
import { buildAppHeader } from './components/appHeader';
import { TaskFormModal, type TaskFormPayload } from './components/taskFormModal';
import { TaskDetailView } from './components/taskDetailView';
import { buildKanbanBoard } from './components/kanbanBoard';
import { BacklogView, type StoryFormPayload } from './components/backlogView';
import { ProjectsSection, type ProjectFormPayload } from './components/projectsSection';

export class App {
  private projectStorage = new ProjectStorage();
  private storyStorage = new StoryStorage();
  private taskStorage = new TaskStorage();
  private userService = UserService.getInstance();
  private notificationStorage = new NotificationStorage();
  private root: HTMLElement;
  private fieldIdCounter = 0;

  // State
  private currentDetailTab: 'backlog' | 'kanban' = 'backlog';
  private currentTaskDetailId: string | null = null;

  // Main view DOM
  private mainView!: HTMLElement;

  // Detail view DOM
  private detailSection!: HTMLElement;
  private detailProjectTitle!: HTMLHeadingElement;
  private detailProjectDesc!: HTMLElement;
  private backlogTabBtn!: HTMLButtonElement;
  private boardTabBtn!: HTMLButtonElement;
  private backlogContent!: HTMLElement;
  private kanbanContent!: HTMLElement;

  private usersScreen!: UsersScreen;
  private notificationCenter!: NotificationCenter;
  private taskFormModal!: TaskFormModal;
  private taskDetailView!: TaskDetailView;
  private backlogView!: BacklogView;
  private projectsSection!: ProjectsSection;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app-shell';
    this.buildUI();
    this.refresh();
  }

  private buildUI() {
    this.mainView = el('div', 'view view-main');
    this.projectsSection = new ProjectsSection({
      createField: (labelText, input) => this.createField(labelText, input),
      onSubmitProject: (payload) => this.handleProjectSubmit(payload),
      onOpenProject: (projectId) => this.showProjectDetail(projectId),
      onDeleteProject: (projectId) => this.removeProject(projectId),
    });
    this.mainView.append(this.projectsSection.element);

    this.backlogView = new BacklogView({
      createField: (labelText, input) => this.createField(labelText, input),
      getSelectableUsers: () => this.userService.getSelectableForStory(),
      getUserById: (id) => this.userService.getUserById(id),
      getStoryById: (id) => this.storyStorage.getById(id),
      onSubmitStory: (payload) => this.handleStorySubmit(payload),
      onDeleteStory: (storyId) => this.removeStory(storyId),
      onCycleStoryStatus: (storyId) => this.cycleStoryStatus(storyId),
      onAddTask: (storyId) => this.openTaskForm(storyId),
      onEditTask: (storyId, taskId) => this.openTaskForm(storyId, taskId),
      onDeleteTask: (taskId) => this.deleteTask(taskId),
      onCycleTaskStatus: (taskId) => this.cycleTaskStatus(taskId),
      onShowTaskDetail: (taskId) => this.showTaskDetail(taskId),
    });
    this.buildDetailSection();
    this.taskDetailView = new TaskDetailView({
      onBack: () => this.backFromTaskDetail(),
      onAssignUser: (taskId, userId) => this.assignUserToTask(taskId, userId),
      onClearAssignee: (task) => this.clearTaskAssignee(task),
      onUpdateEstimatedHours: (task, estimatedHours) => this.updateTaskEstimatedHours(task, estimatedHours),
      onUpdateActualHours: (task, actualHours) => this.updateTaskActualHours(task, actualHours),
      onCompleteTask: (taskId) => this.completeTask(taskId),
    });
    this.taskFormModal = new TaskFormModal({
      createField: (labelText, input) => this.createField(labelText, input),
      onSubmit: (payload) => this.handleTaskFormSubmit(payload),
    });
    this.notificationCenter = new NotificationCenter({
      notificationStorage: this.notificationStorage,
      userService: this.userService,
      onBackToPreviousView: () => this.restorePreviousView(),
    });
    this.usersScreen = new UsersScreen({
      userService: this.userService,
      onBack: () => this.restorePreviousView(),
    });

    this.root.append(
      this.buildHeader(),
      this.mainView,
      this.detailSection,
      this.taskDetailView.element,
      this.notificationCenter.listView,
      this.notificationCenter.detailView,
      this.usersScreen.element,
      this.taskFormModal.element,
      this.notificationCenter.dialog,
    );
  }

  // ─── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    return buildAppHeader({
      user: this.userService.getLoggedUser(),
      notificationBadge: this.notificationCenter.badge,
      onShowNotifications: () => this.showNotifList(),
      onShowUsers: () => this.showUsersView(),
    });
  }

  // ─── Projects section ─────────────────────────────────────────────────────────

  private handleProjectSubmit(payload: ProjectFormPayload) {
    const { editProjectId, name, description } = payload;
    const isNew = !editProjectId;
    const saved = this.withStorage(() => {
      if (editProjectId) {
        this.projectStorage.update({ id: editProjectId, name, description });
      } else {
        this.projectStorage.create({ name, description });
      }
    });
    if (saved) {
      if (isNew) {
        this.userService.getAllUsers()
          .filter((u) => u.role === 'admin')
          .forEach((admin) => {
            this.sendNotification({
              title: 'New project created',
              message: `A new project "${name}" has been created.`,
              priority: 'high',
              recipientId: admin.id,
            });
          });
      }
      this.projectsSection.closeForm();
      this.refreshProjects();
    }
  }

  private removeProject(id: string) {
    if (!confirm('Are you sure you want to delete this project and all its stories?')) return;
    const saved = this.withStorage(() => {
      const stories = this.storyStorage.getAllByProject(id);
      stories.forEach((s) => this.taskStorage.deleteByStory(s.id));
      this.storyStorage.deleteByProject(id);
      this.projectStorage.delete(id);
      if (this.projectStorage.getActiveProjectId() === id) {
        this.projectStorage.setActiveProjectId(null);
      }
    });
    if (saved) {
      this.projectsSection.clearEditingIfProject(id);
      this.refresh();
    }
  }

  // ─── Detail section ───────────────────────────────────────────────────────────

  private buildDetailSection() {
    this.detailSection = el('div', 'view view-detail view--hidden');

    const backBtn = el('button', 'button button-back', '← Back to Projects');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.showMainView());

    const detailProjectHeader = el('div', 'detail-project-header');
    this.detailProjectTitle = el('h2', 'detail-project-title');
    this.detailProjectDesc = el('p', 'detail-project-desc');
    detailProjectHeader.append(this.detailProjectTitle, this.detailProjectDesc);

    const tabBar = el('div', 'tab-bar');
    this.backlogTabBtn = el('button', 'tab-btn tab-btn--active', 'Backlog');
    this.backlogTabBtn.type = 'button';
    this.backlogTabBtn.addEventListener('click', () => this.switchTab('backlog'));
    this.boardTabBtn = el('button', 'tab-btn', 'Board');
    this.boardTabBtn.type = 'button';
    this.boardTabBtn.addEventListener('click', () => this.switchTab('kanban'));
    tabBar.append(this.backlogTabBtn, this.boardTabBtn);

    this.backlogContent = el('div', 'tab-content');
    this.backlogContent.append(this.backlogView.element);

    this.kanbanContent = el('div', 'tab-content tab-content--hidden');

    const detailMain = el('div', 'detail-main');
    detailMain.append(backBtn, detailProjectHeader, tabBar, this.backlogContent, this.kanbanContent);

    const teamSidebar = el('aside', 'team-sidebar');
    teamSidebar.append(buildTeamSection(this.userService));

    const detailLayout = el('div', 'detail-layout');
    detailLayout.append(detailMain, teamSidebar);

    this.detailSection.append(detailLayout);
  }

  private switchTab(tab: 'backlog' | 'kanban') {
    this.currentDetailTab = tab;
    if (tab === 'backlog') {
      this.backlogTabBtn.classList.add('tab-btn--active');
      this.boardTabBtn.classList.remove('tab-btn--active');
      this.backlogContent.classList.remove('tab-content--hidden');
      this.kanbanContent.classList.add('tab-content--hidden');
    } else {
      this.boardTabBtn.classList.add('tab-btn--active');
      this.backlogTabBtn.classList.remove('tab-btn--active');
      this.kanbanContent.classList.remove('tab-content--hidden');
      this.backlogContent.classList.add('tab-content--hidden');
      this.refreshKanban();
    }
  }

  private showProjectDetail(id: string) {
    const project = this.projectStorage.getById(id);
    if (!project) return;
    this.projectStorage.setActiveProjectId(id);
    this.detailProjectTitle.textContent = project.name;
    this.detailProjectDesc.textContent = project.description;
    this.currentDetailTab = 'backlog';
    this.backlogTabBtn.classList.add('tab-btn--active');
    this.boardTabBtn.classList.remove('tab-btn--active');
    this.backlogContent.classList.remove('tab-content--hidden');
    this.kanbanContent.classList.add('tab-content--hidden');
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.remove('view--hidden');
    this.taskDetailView.hide();
    this.notificationCenter.hideAll();
    this.usersScreen.hide();
    this.backlogView.closeStoryForm();
    this.refreshStories();
  }

  private showMainView() {
    this.mainView.classList.remove('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.hide();
    this.notificationCenter.hideAll();
    this.usersScreen.hide();
    this.refresh();
  }

  private handleStorySubmit(payload: StoryFormPayload) {
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) {
      this.showToast('No active project selected.');
      return;
    }

    const user = this.userService.getLoggedUser();
    const { editStoryId, name, description, priority, status, assigneeId } = payload;

    const prevAssigneeId = editStoryId
      ? (this.storyStorage.getById(editStoryId)?.assigneeId ?? null)
      : null;

    const saved = this.withStorage(() => {
      if (editStoryId) {
        const existing = this.storyStorage.getById(editStoryId);
        if (existing) {
          this.storyStorage.update({ ...existing, name, description, priority, status, assigneeId });
        }
      } else {
        this.storyStorage.create({ name, description, priority, status, assigneeId, projectId: activeId, ownerId: user.id });
      }
    });
    if (saved) {
      if (assigneeId && assigneeId !== prevAssigneeId) {
        this.sendNotification({
          title: 'Assigned to a user story',
          message: `You have been assigned to story "${name}".`,
          priority: 'high',
          recipientId: assigneeId,
        });
      }
      this.backlogView.closeStoryForm();
      this.refreshStories();
    }
  }

  private removeStory(id: string) {
    if (!confirm('Are you sure you want to delete this story and all its tasks?')) return;
    const saved = this.withStorage(() => {
      this.taskStorage.deleteByStory(id);
      this.storyStorage.delete(id);
    });
    if (saved) {
      this.backlogView.clearEditingIfStory(id);
      this.refreshStories();
    }
  }

  private cycleStoryStatus(id: string) {
    const story = this.storyStorage.getById(id);
    if (!story) return;
    const cycle: StoryStatus[] = ['todo', 'doing', 'done'];
    const next = cycle[(cycle.indexOf(story.status) + 1) % cycle.length];
    const saved = this.withStorage(() => this.storyStorage.update({ ...story, status: next }));
    if (saved) this.refreshStories();
  }

  private refreshStories() {
    const activeId = this.projectStorage.getActiveProjectId();
    const activeProject = activeId ? this.projectStorage.getById(activeId) : undefined;
    if (!activeId || !activeProject) {
      this.backlogView.render({ activeProjectExists: false, stories: [], tasksByStoryId: new Map() });
      return;
    }

    const stories = this.storyStorage.getAllByProject(activeId);
    this.backlogView.render({
      activeProjectExists: true,
      stories,
      tasksByStoryId: new Map(stories.map((story) => [story.id, this.taskStorage.getAllByStory(story.id)])),
    });
  }

  // ─── Task CRUD ────────────────────────────────────────────────────────────────

  private deleteTask(taskId: string) {
    if (!confirm('Delete this task?')) return;
    const task = this.taskStorage.getById(taskId);
    const story = task ? this.storyStorage.getById(task.storyId) : null;
    const saved = this.withStorage(() => this.taskStorage.delete(taskId));
    if (saved) {
      if (task && story) {
        this.sendNotification({
          title: 'Task removed from story',
          message: `Task "${task.name}" was removed from story "${story.name}".`,
          priority: 'medium',
          recipientId: story.ownerId,
        });
      }
      this.refreshStories();
      if (this.currentDetailTab === 'kanban') this.refreshKanban();
    }
  }

  private syncStoryStatus(storyId: string): void {
    const story = this.storyStorage.getById(storyId);
    if (!story) return;
    const tasks = this.taskStorage.getAllByStory(storyId);
    if (tasks.length === 0) return;

    if (tasks.every((t) => t.status === 'done')) {
      if (story.status !== 'done') this.storyStorage.update({ ...story, status: 'done' });
    } else if (tasks.some((t) => t.status === 'doing') && story.status === 'todo') {
      this.storyStorage.update({ ...story, status: 'doing' });
    }
  }

  private assignUserToTask(taskId: string, userId: string) {
    const task = this.taskStorage.getById(taskId);
    if (!task) return;
    const prevAssigneeId = task.assigneeId;

    if (task.status === 'done') {
      this.withStorage(() => this.taskStorage.update({ ...task, assigneeId: userId }));
      if (prevAssigneeId !== userId) this.notifyTaskAssignment(task, userId);
      this.refreshAfterTaskChange(taskId);
      return;
    }

    const saved = this.withStorage(() => {
      this.taskStorage.update({
        ...task,
        assigneeId: userId,
        status: 'doing',
        startedAt: task.startedAt ?? new Date().toISOString(),
      });
      this.syncStoryStatus(task.storyId);
    });
    if (saved) {
      if (prevAssigneeId !== userId) this.notifyTaskAssignment(task, userId);
      this.refreshAfterTaskChange(taskId);
    }
  }

  private notifyTaskAssignment(task: Task, assigneeId: string): void {
    const story = this.storyStorage.getById(task.storyId);
    this.sendNotification({
      title: 'Assigned to a task',
      message: story
        ? `You have been assigned to task "${task.name}" in story "${story.name}".`
        : `You have been assigned to task "${task.name}".`,
      priority: 'high',
      recipientId: assigneeId,
    });
  }

  private completeTask(taskId: string) {
    const task = this.taskStorage.getById(taskId);
    if (!task || task.status === 'done') return;

    const saved = this.withStorage(() => {
      this.taskStorage.update({
        ...task,
        status: 'done',
        completedAt: task.completedAt ?? new Date().toISOString(),
      });
      this.syncStoryStatus(task.storyId);
    });
    if (saved) {
      const story = this.storyStorage.getById(task.storyId);
      if (story) {
        this.sendNotification({
          title: 'Task marked as done',
          message: `Task "${task.name}" in story "${story.name}" is now Done.`,
          priority: 'medium',
          recipientId: story.ownerId,
        });
      }
      this.refreshAfterTaskChange(taskId);
    }
  }

  private cycleTaskStatus(taskId: string) {
    const task = this.taskStorage.getById(taskId);
    if (!task) return;

    const cycle: TaskStatus[] = ['todo', 'doing', 'done'];
    const next = cycle[(cycle.indexOf(task.status) + 1) % cycle.length];
    const updated: Task = {
      ...task,
      status: next,
      startedAt: next === 'doing' || next === 'done' ? task.startedAt ?? new Date().toISOString() : task.startedAt,
      completedAt: next === 'done' ? task.completedAt ?? new Date().toISOString() : null,
    };

    const saved = this.withStorage(() => {
      this.taskStorage.update(updated);
      this.syncStoryStatus(task.storyId);
    });
    if (saved) {
      if (next === 'done' || next === 'doing') {
        const story = this.storyStorage.getById(task.storyId);
        if (story) {
          this.sendNotification({
            title: `Task status changed to ${next === 'done' ? 'Done' : 'In Progress'}`,
            message: `Task "${task.name}" in story "${story.name}" is now ${next === 'done' ? 'Done' : 'In Progress'}.`,
            priority: next === 'done' ? 'medium' : 'low',
            recipientId: story.ownerId,
          });
        }
      }
      this.refreshAfterTaskChange(taskId);
    }
  }

  private refreshAfterTaskChange(taskId: string) {
    this.refreshStories();
    if (this.currentDetailTab === 'kanban') this.refreshKanban();
    if (this.currentTaskDetailId === taskId) this.renderTaskDetailContent();
  }

  private clearTaskAssignee(task: Task): void {
    const saved = this.withStorage(() => this.taskStorage.update({ ...task, assigneeId: null }));
    if (saved) this.refreshAfterTaskChange(task.id);
  }

  private updateTaskEstimatedHours(task: Task, estimatedHours: number): void {
    const saved = this.withStorage(() => this.taskStorage.update({ ...task, estimatedHours }));
    if (saved) this.refreshAfterTaskChange(task.id);
  }

  private updateTaskActualHours(task: Task, actualHours: number | null): void {
    const saved = this.withStorage(() => this.taskStorage.update({ ...task, actualHours }));
    if (saved) this.refreshAfterTaskChange(task.id);
  }

  private openTaskForm(storyId?: string, taskId?: string) {
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) return;

    const stories = this.storyStorage.getAllByProject(activeId);
    const task = taskId ? this.taskStorage.getById(taskId) : undefined;
    if (taskId && !task) return;
    this.taskFormModal.open(stories, storyId, task);
  }

  private handleTaskFormSubmit(payload: TaskFormPayload) {
    const { editedTaskId, storyId, name, description, priority, estimatedHours } = payload;

    const saved = this.withStorage(() => {
      if (editedTaskId) {
        const existing = this.taskStorage.getById(editedTaskId);
        if (existing) {
          this.taskStorage.update({ ...existing, name, description, priority, estimatedHours, storyId });
        }
      } else {
        this.taskStorage.create({ name, description, priority, estimatedHours, storyId, status: 'todo' });
      }
    });

    if (saved) {
      if (!editedTaskId) {
        const story = this.storyStorage.getById(storyId);
        if (story) {
          this.sendNotification({
            title: 'New task added to your story',
            message: `A new task "${name}" was added to story "${story.name}".`,
            priority: 'medium',
            recipientId: story.ownerId,
          });
        }
      }
      this.taskFormModal.close();
      this.refreshStories();
      if (this.currentDetailTab === 'kanban') this.refreshKanban();
      if (this.currentTaskDetailId === editedTaskId) this.renderTaskDetailContent();
    }
  }

  private showTaskDetail(taskId: string) {
    this.currentTaskDetailId = taskId;
    const task = this.taskStorage.getById(taskId);
    if (!task) return;
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.show();
    this.notificationCenter.hideAll();
    this.usersScreen.hide();
    this.renderTaskDetailContent();
  }

  private backFromTaskDetail() {
    this.taskDetailView.hide();
    const activeId = this.projectStorage.getActiveProjectId();
    if (activeId) {
      this.detailSection.classList.remove('view--hidden');
      this.refreshStories();
      if (this.currentDetailTab === 'kanban') this.refreshKanban();
    } else {
      this.mainView.classList.remove('view--hidden');
    }
  }

  private renderTaskDetailContent() {
    if (!this.currentTaskDetailId) return;
    const task = this.taskStorage.getById(this.currentTaskDetailId);
    if (!task) return;
    const story = this.storyStorage.getById(task.storyId);

    this.taskDetailView.render({
      task,
      story,
      assignableUsers: this.userService.getAssignableUsers(),
    });
  }

  // ─── Kanban board ─────────────────────────────────────────────────────────────

  private refreshKanban() {
    const activeId = this.projectStorage.getActiveProjectId();
    this.kanbanContent.innerHTML = '';
    if (!activeId) return;

    const stories = this.storyStorage.getAllByProject(activeId);
    const storyIds = stories.map((s) => s.id);
    const allTasks = this.taskStorage.getAllByStories(storyIds);

    this.kanbanContent.append(buildKanbanBoard({
      stories,
      tasks: allTasks,
      getUserById: (id) => this.userService.getUserById(id),
      onTaskClick: (taskId) => this.showTaskDetail(taskId),
    }));
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  private refresh() {
    this.refreshProjects();
    this.refreshStories();
    this.notificationCenter.refreshBadge();
  }

  private refreshProjects() {
    const projects = this.projectStorage.getAll();
    const activeId = this.projectStorage.getActiveProjectId();
    this.projectsSection.render(projects, activeId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private createField(labelText: string, input: HTMLElement): HTMLElement {
    const id = `field-${++this.fieldIdCounter}`;
    input.id = id;
    const label = el('label', undefined, labelText);
    label.htmlFor = id;
    const wrapper = el('div', 'form-group');
    wrapper.append(label, input);
    return wrapper;
  }

  private showToast(message: string, type: 'error' | 'info' = 'error'): void {
    const toast = el('div', `toast toast--${type}`, message);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  private withStorage(fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (e) {
      console.error(e);
      this.showToast('Failed to save — storage may be full.');
      return false;
    }
  }

  // ─── Notifications: navigation ────────────────────────────────────────────────

  private showNotifList(): void {
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.hide();
    this.usersScreen.hide();
    this.notificationCenter.showList();
  }

  private restorePreviousView(): void {
    const taskId = this.currentTaskDetailId;
    const activeProjectId = this.projectStorage.getActiveProjectId();
    if (taskId && this.taskStorage.getById(taskId)) {
      this.showTaskDetail(taskId);
    } else if (activeProjectId && this.projectStorage.getById(activeProjectId)) {
      this.showProjectDetail(activeProjectId);
    } else {
      this.showMainView();
    }
  }

  // ─── Notifications: send + badge + dialog ─────────────────────────────────────

  private sendNotification(data: Parameters<NotificationCenter['send']>[0]): void {
    this.notificationCenter.send(data);
  }

  private showUsersView(): void {
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.hide();
    this.notificationCenter.hideAll();
    this.usersScreen.show();
  }
}
