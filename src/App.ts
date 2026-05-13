import { Project, ProjectStorage } from './api/projectStorage';
import { Story, StoryStatus, Priority } from './models/Story';
import { StoryStorage } from './api/storyStorage';
import { Task, TaskStatus, TaskPriority } from './models/Task';
import { TaskStorage } from './api/taskStorage';
import { User } from './models/User';
import { UserService } from './api/userService';
import { Notification as AppNotification } from './models/Notification';
import { NotificationStorage } from './api/notificationStorage';
import { AuthService } from './api/authService';
import { UserRole } from './models/User';
import trashSvg from './assets/icons/trash.svg?raw';
import editSvg from './assets/icons/edit.svg?raw';
import bookSvg from './assets/icons/book.svg?raw';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const PRIORITY_LABELS: Record<TaskPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const STORY_STATUS_LABELS: Record<StoryStatus, string> = { todo: 'New', doing: 'In Progress', done: 'Done' };
const TASK_STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', developer: 'Developer', devops: 'DevOps', guest: 'Guest' };

const TASK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export class App {
  private projectStorage = new ProjectStorage();
  private storyStorage = new StoryStorage();
  private taskStorage = new TaskStorage();
  private userService = UserService.getInstance();
  private notificationStorage = new NotificationStorage();
  private root: HTMLElement;
  private fieldIdCounter = 0;

  // State
  private expandedStoryIds = new Set<string>();
  private currentDetailTab: 'backlog' | 'kanban' = 'backlog';
  private currentEditProjectId: string | null = null;
  private currentEditStoryId: string | null = null;
  private currentEditTaskId: string | null = null;
  private taskFormContextStoryId: string | null = null;
  private currentTaskDetailId: string | null = null;
  private currentNotifId: string | null = null;
  private notifDialogQueue: AppNotification[] = [];
  private notifDialogActive = false;

  // Main view DOM
  private mainView!: HTMLElement;
  private projectFormWrapper!: HTMLElement;
  private projectForm!: HTMLFormElement;
  private projectNameInput!: HTMLInputElement;
  private projectDescInput!: HTMLTextAreaElement;
  private projectSubmitBtn!: HTMLButtonElement;
  private projectListContainer!: HTMLElement;

  // Detail view DOM
  private detailSection!: HTMLElement;
  private detailProjectTitle!: HTMLHeadingElement;
  private detailProjectDesc!: HTMLElement;
  private backlogTabBtn!: HTMLButtonElement;
  private boardTabBtn!: HTMLButtonElement;
  private backlogContent!: HTMLElement;
  private kanbanContent!: HTMLElement;

  // Story form DOM
  private storiesSection!: HTMLElement;
  private storyList!: HTMLElement;
  private storyFormWrapper!: HTMLElement;
  private storyFormTitle!: HTMLElement;
  private storyForm!: HTMLFormElement;
  private storyNameInput!: HTMLInputElement;
  private storyDescInput!: HTMLTextAreaElement;
  private storyPrioritySelect!: HTMLSelectElement;
  private storyStatusSelect!: HTMLSelectElement;
  private storyAssigneeSelect!: HTMLSelectElement;
  private storySubmitBtn!: HTMLButtonElement;

  // Task detail view DOM
  private taskDetailView!: HTMLElement;
  private taskDetailContent!: HTMLElement;
  private taskDetailBackLabel!: HTMLSpanElement;

  // Users view DOM
  private usersView!: HTMLElement;
  private usersListContent!: HTMLElement;

  // Notification views DOM
  private notifBadge!: HTMLElement;
  private notifListView!: HTMLElement;
  private notifListContainer!: HTMLElement;
  private notifDetailView!: HTMLElement;
  private notifDetailContentEl!: HTMLElement;
  private notifDialog!: HTMLElement;
  private notifDialogTitle!: HTMLElement;
  private notifDialogMessage!: HTMLElement;
  private notifDialogPriority!: HTMLElement;
  private notifDialogViewBtn!: HTMLButtonElement;

  // Task form modal DOM
  private taskFormModal!: HTMLElement;
  private taskFormTitle!: HTMLElement;
  private taskNameInput!: HTMLInputElement;
  private taskDescInput!: HTMLTextAreaElement;
  private taskPrioritySelect!: HTMLSelectElement;
  private taskEstHoursInput!: HTMLInputElement;
  private taskFormSubmitBtn!: HTMLButtonElement;
  private taskFormStorySelect!: HTMLSelectElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app-shell';
    this.buildUI();
    this.refresh();
  }

  private buildUI() {
    this.mainView = el('div', 'view view-main');
    this.mainView.append(this.buildProjectsSection());

    this.buildDetailSection();
    this.buildTaskDetailView();
    this.buildTaskFormModal();
    this.buildNotifListView();
    this.buildNotifDetailView();
    this.buildNotifDialog();
    this.buildUsersView();

    this.root.append(
      this.buildHeader(),
      this.mainView,
      this.detailSection,
      this.taskDetailView,
      this.notifListView,
      this.notifDetailView,
      this.usersView,
      this.taskFormModal,
      this.notifDialog,
    );
  }

  // ─── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const user = this.userService.getLoggedUser();
    const header = el('header', 'app-header');

    const brand = el('div', 'app-header__brand');
    const h1 = el('h1');
    h1.textContent = 'ManageMe';
    brand.append(h1);

    const right = el('div', 'app-header__right');

    const themeBtn = el('button', 'theme-toggle');
    themeBtn.type = 'button';
    themeBtn.setAttribute('aria-label', 'Toggle dark mode');
    const isDark = document.documentElement.classList.contains('dark');
    themeBtn.textContent = isDark ? '☀' : '☾';
    themeBtn.addEventListener('click', () => {
      const dark = document.documentElement.classList.toggle('dark');
      themeBtn.textContent = dark ? '☀' : '☾';
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    });

    const notifBellWrapper = el('div', 'notif-bell-wrapper');
    const notifBellBtn = el('button', 'notif-bell-btn');
    notifBellBtn.type = 'button';
    notifBellBtn.setAttribute('aria-label', 'Notifications');
    notifBellBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
    notifBellBtn.addEventListener('click', () => this.showNotifList());
    this.notifBadge = el('span', 'notif-bell-dot notif-bell-dot--hidden');
    notifBellWrapper.append(notifBellBtn, this.notifBadge);

    const userInfo = el('div', 'app-header__user');
    const avatar = el('span', 'user-avatar', `${user.firstName[0]}${user.lastName[0]}`);
    const userName = el('span', 'user-name', `${user.firstName} ${user.lastName}`);
    userInfo.append(avatar, userName);

    right.append(themeBtn, notifBellWrapper);

    if (user.role === 'admin') {
      const usersBtn = el('button', 'notif-nav-link', 'Users');
      usersBtn.type = 'button';
      usersBtn.addEventListener('click', () => this.showUsersView());
      right.append(usersBtn);
    }

    const signOutBtn = el('button', 'notif-nav-link', 'Sign out');
    signOutBtn.type = 'button';
    signOutBtn.addEventListener('click', () => {
      AuthService.getInstance().clearSession();
      if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
      window.location.reload();
    });

    right.append(userInfo, signOutBtn);
    header.append(brand, right);
    return header;
  }

  // ─── Team section ─────────────────────────────────────────────────────────────

  private buildTeamSection(): HTMLElement {
    const section = el('section', 'team-section');
    const loggedUser = this.userService.getLoggedUser();

    const adminGroup = el('div', 'team-sidebar-group');
    adminGroup.append(el('h2', 'team-sidebar-title', 'Admin'));
    const lead = this.buildTeamMember(loggedUser, 'team-member team-member--lead', false);
    adminGroup.append(lead);

    const teamGroup = el('div', 'team-sidebar-group');
    teamGroup.append(el('h2', 'team-sidebar-title', 'Team'));

    const list = el('div', 'team-list');
    this.userService
      .getAllUsers()
      .filter((user) => user.id !== loggedUser.id)
      .forEach((user) => {
        list.append(this.buildTeamMember(user));
      });
    teamGroup.append(list);

    section.append(adminGroup, teamGroup);
    return section;
  }

  private buildTeamMember(user: User, className = 'team-member', showRole = true): HTMLElement {
    const item = el('div', className);
    const avatar = el('span', 'user-avatar user-avatar--sm', `${user.firstName[0]}${user.lastName[0]}`);
    const info = el('div', 'team-member__info');
    info.append(el('span', 'team-member__name', `${user.firstName} ${user.lastName}`));
    if (showRole) {
      info.append(el('span', `role-badge role-badge--${user.role}`, ROLE_LABELS[user.role]));
    }
    item.append(avatar, info);
    return item;
  }

  // ─── Projects section ─────────────────────────────────────────────────────────

  private buildProjectsSection(): HTMLElement {
    const section = el('section', 'projects-section');

    const titleBar = el('div', 'section-title-bar');
    const h2 = el('h2', undefined, 'Projects');
    const addBtn = el('button', 'button button-primary', '+ Add project');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => this.toggleProjectForm());
    titleBar.append(h2, addBtn);

    this.projectFormWrapper = el('div', 'form-wrapper form-wrapper--hidden');
    this.projectForm = el('form', 'form-card');
    this.projectNameInput = el('input');
    this.projectNameInput.type = 'text';
    this.projectNameInput.placeholder = 'Project name';
    this.projectNameInput.required = true;
    this.projectDescInput = el('textarea');
    this.projectDescInput.placeholder = 'Project description';
    this.projectDescInput.rows = 3;
    this.projectDescInput.required = true;
    this.projectSubmitBtn = el('button', 'button button-primary', 'Save');
    this.projectSubmitBtn.type = 'submit';
    const cancelBtn = el('button', 'button button-cancel', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => this.cancelProjectForm());
    const formActions = el('div', 'form-actions');
    formActions.append(this.projectSubmitBtn, cancelBtn);
    this.projectForm.append(
      this.createField('Name', this.projectNameInput),
      this.createField('Description', this.projectDescInput),
      formActions,
    );
    this.projectForm.addEventListener('submit', (e) => this.handleProjectSubmit(e));
    this.projectFormWrapper.append(this.projectForm);

    this.projectListContainer = el('div');
    section.append(titleBar, this.projectFormWrapper, this.projectListContainer);
    return section;
  }

  private toggleProjectForm(forceOpen = false) {
    const isHidden = this.projectFormWrapper.classList.contains('form-wrapper--hidden');
    if (isHidden || forceOpen) {
      this.projectFormWrapper.classList.remove('form-wrapper--hidden');
      this.refreshProjects();
    } else {
      this.cancelProjectForm();
    }
  }

  private closeProjectForm() {
    this.projectFormWrapper.classList.add('form-wrapper--hidden');
    this.projectForm.reset();
    this.currentEditProjectId = null;
    this.projectSubmitBtn.textContent = 'Save';
  }

  private cancelProjectForm() {
    this.closeProjectForm();
    this.refreshProjects();
  }

  private handleProjectSubmit(e: Event) {
    e.preventDefault();
    const name = this.projectNameInput.value.trim();
    const description = this.projectDescInput.value.trim();
    if (!name || !description) return;
    const isNew = !this.currentEditProjectId;
    const saved = this.withStorage(() => {
      if (this.currentEditProjectId) {
        this.projectStorage.update({ id: this.currentEditProjectId, name, description });
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
      this.cancelProjectForm();
    }
  }

  private loadProjectForEdit(id: string) {
    const project = this.projectStorage.getById(id);
    if (!project) return;
    this.currentEditProjectId = id;
    this.projectNameInput.value = project.name;
    this.projectDescInput.value = project.description;
    this.projectSubmitBtn.textContent = 'Update';
    this.toggleProjectForm(true);
    this.projectFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      if (this.currentEditProjectId === id) this.closeProjectForm();
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
    this.backlogContent.append(this.buildStoriesSection());

    this.kanbanContent = el('div', 'tab-content tab-content--hidden');

    const detailMain = el('div', 'detail-main');
    detailMain.append(backBtn, detailProjectHeader, tabBar, this.backlogContent, this.kanbanContent);

    const teamSidebar = el('aside', 'team-sidebar');
    teamSidebar.append(this.buildTeamSection());

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
    this.taskDetailView.classList.add('view--hidden');
    this.notifListView.classList.add('view--hidden');
    this.notifDetailView.classList.add('view--hidden');
    this.usersView.classList.add('view--hidden');
    this.cancelStoryForm();
    this.refreshStories();
  }

  private showMainView() {
    this.mainView.classList.remove('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.classList.add('view--hidden');
    this.notifListView.classList.add('view--hidden');
    this.notifDetailView.classList.add('view--hidden');
    this.usersView.classList.add('view--hidden');
    this.refresh();
  }

  // ─── Stories section ──────────────────────────────────────────────────────────

  private buildStoriesSection(): HTMLElement {
    this.storiesSection = el('section', 'stories-section stories-section--hidden');

    const titleBar = el('div', 'section-title-bar');
    const h2 = el('h2', undefined, 'Stories');
    const addBtn = el('button', 'button button-primary', '+ Add story');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => this.openStoryForm());
    titleBar.append(h2, addBtn);

    this.storyFormWrapper = el('div', 'modal-overlay modal-overlay--hidden');
    const dialog = el('div', 'modal-dialog');

    const modalHeader = el('div', 'modal-header');
    this.storyFormTitle = el('h3', 'modal-title', 'Add User Story');
    const closeBtn = el('button', 'modal-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.closeStoryForm());
    modalHeader.append(this.storyFormTitle, closeBtn);

    this.storyForm = el('form', 'form-card modal-form');

    this.storyNameInput = el('input');
    this.storyNameInput.type = 'text';
    this.storyNameInput.placeholder = 'Story title';
    this.storyNameInput.required = true;

    this.storyDescInput = el('textarea');
    this.storyDescInput.placeholder = 'Story description';
    this.storyDescInput.rows = 3;
    this.storyDescInput.required = true;

    this.storyPrioritySelect = el('select');
    (['low', 'medium', 'high'] as Priority[]).forEach((p) => {
      const opt = el('option');
      opt.value = p;
      opt.textContent = PRIORITY_LABELS[p];
      this.storyPrioritySelect.append(opt);
    });

    this.storyStatusSelect = el('select');
    (['todo', 'doing', 'done'] as StoryStatus[]).forEach((s) => {
      const opt = el('option');
      opt.value = s;
      opt.textContent = STORY_STATUS_LABELS[s];
      this.storyStatusSelect.append(opt);
    });

    this.storyAssigneeSelect = el('select');

    this.storySubmitBtn = el('button', 'button button-primary', 'Save');
    this.storySubmitBtn.type = 'submit';
    const cancelStoryBtn = el('button', 'button button-cancel', 'Cancel');
    cancelStoryBtn.type = 'button';
    cancelStoryBtn.addEventListener('click', () => this.closeStoryForm());
    const storyFormActions = el('div', 'form-actions');
    storyFormActions.append(this.storySubmitBtn, cancelStoryBtn);

    const storyFormRow = el('div', 'form-card__row');
    storyFormRow.append(
      this.createField('Priority', this.storyPrioritySelect),
      this.createField('Status', this.storyStatusSelect),
      this.createField('Assignee', this.storyAssigneeSelect),
    );

    this.storyForm.append(
      this.createField('Title', this.storyNameInput),
      this.createField('Description', this.storyDescInput),
      storyFormRow,
      storyFormActions,
    );
    this.storyForm.addEventListener('submit', (e) => this.handleStorySubmit(e));
    dialog.append(modalHeader, this.storyForm);
    this.storyFormWrapper.append(dialog);
    this.storyFormWrapper.addEventListener('click', (e) => {
      if (e.target === this.storyFormWrapper) this.closeStoryForm();
    });

    this.storyList = el('div', 'story-list');
    this.storiesSection.append(titleBar, this.storyFormWrapper, this.storyList);
    return this.storiesSection;
  }

  private openStoryForm(id?: string) {
    this.currentEditStoryId = id ?? null;
    this.storyForm.reset();

    // Rebuild assignee options with current users
    this.storyAssigneeSelect.innerHTML = '';
    const unassignedOpt = el('option');
    unassignedOpt.value = '';
    unassignedOpt.textContent = 'Unassigned';
    this.storyAssigneeSelect.append(unassignedOpt);
    this.userService.getSelectableForStory().forEach((u) => {
      const opt = el('option');
      opt.value = u.id;
      opt.textContent = `${u.firstName} ${u.lastName}`;
      this.storyAssigneeSelect.append(opt);
    });

    if (id) {
      const story = this.storyStorage.getById(id);
      if (!story) return;
      this.storyFormTitle.textContent = 'Edit User Story';
      this.storyNameInput.value = story.name;
      this.storyDescInput.value = story.description;
      this.storyPrioritySelect.value = story.priority;
      this.storyStatusSelect.value = story.status;
      this.storyAssigneeSelect.value = story.assigneeId ?? '';
      this.storySubmitBtn.textContent = 'Update';
    } else {
      this.storyFormTitle.textContent = 'Add User Story';
      this.storyPrioritySelect.value = 'medium';
      this.storyStatusSelect.value = 'todo';
      this.storyAssigneeSelect.value = '';
      this.storySubmitBtn.textContent = 'Save';
    }

    this.storyFormWrapper.classList.remove('modal-overlay--hidden');
  }

  private closeStoryForm() {
    this.storyFormWrapper.classList.add('modal-overlay--hidden');
    this.storyForm.reset();
    this.currentEditStoryId = null;
    this.storySubmitBtn.textContent = 'Save';
  }

  private cancelStoryForm() {
    this.closeStoryForm();
  }

  private handleStorySubmit(e: Event) {
    e.preventDefault();
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) {
      this.showToast('No active project selected.');
      return;
    }

    const user = this.userService.getLoggedUser();
    const name = this.storyNameInput.value.trim();
    const description = this.storyDescInput.value.trim();
    const priority = this.storyPrioritySelect.value as Priority;
    const status = this.storyStatusSelect.value as StoryStatus;
    const assigneeId = this.storyAssigneeSelect.value || null;
    if (!name || !description) return;

    const prevAssigneeId = this.currentEditStoryId
      ? (this.storyStorage.getById(this.currentEditStoryId)?.assigneeId ?? null)
      : null;

    const saved = this.withStorage(() => {
      if (this.currentEditStoryId) {
        const existing = this.storyStorage.getById(this.currentEditStoryId);
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
      this.closeStoryForm();
      this.refreshStories();
    }
  }

  private loadStoryForEdit(id: string) {
    this.openStoryForm(id);
  }

  private removeStory(id: string) {
    if (!confirm('Are you sure you want to delete this story and all its tasks?')) return;
    const saved = this.withStorage(() => {
      this.taskStorage.deleteByStory(id);
      this.storyStorage.delete(id);
    });
    if (saved) {
      if (this.currentEditStoryId === id) this.cancelStoryForm();
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

  // ─── Story row + expansion ─────────────────────────────────────────────────────

  private refreshStories() {
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) {
      this.storiesSection.classList.add('stories-section--hidden');
      return;
    }
    const activeProject = this.projectStorage.getById(activeId);
    if (!activeProject) {
      this.storiesSection.classList.add('stories-section--hidden');
      return;
    }
    this.storiesSection.classList.remove('stories-section--hidden');

    const stories = this.storyStorage.getAllByProject(activeId);
    this.storyList.innerHTML = '';

    if (stories.length === 0) {
      this.storyList.append(el('p', 'empty-state', 'No stories yet. Add your first story.'));
      return;
    }

    const table = el('div', 'story-table');
    const header = el('div', 'story-table__header');
    header.append(
      el('span', 'story-col-expand'),
      el('span', 'story-col-id', 'ID'),
      el('span', 'story-col-title', 'Title'),
      el('span', 'story-col-priority', 'Priority'),
      el('span', 'story-col-state', 'State'),
      el('span', 'story-col-actions'),
    );
    table.append(header);

    stories.forEach((story) => {
      const group = this.buildStoryGroup(story);
      table.append(group);
    });
    this.storyList.append(table);
  }

  private buildStoryGroup(story: Story): HTMLElement {
    const owner = this.userService.getUserById(story.ownerId);
    const firstName = owner?.firstName ?? 'Unknown';
    const lastName = owner?.lastName ?? '';
    const group = el('div', 'story-group');

    const isExpanded = this.expandedStoryIds.has(story.id);
    const tasks = this.taskStorage.getAllByStory(story.id);

    // Expand toggle
    const expandBtn = el('button', 'expand-btn');
    expandBtn.type = 'button';
    expandBtn.title = isExpanded ? 'Collapse' : 'Expand tasks';
    expandBtn.innerHTML = isExpanded ? '&#9660;' : '&#9658;';
    if (tasks.length === 0) expandBtn.classList.add('expand-btn--empty');

    const row = el('div', `story-row story-row--${story.status}`);

    const idCell = el('span', 'story-col-id story-row__id', String(story.uid));

    const titleCell = el('div', 'story-col-title story-row__title-cell');
    const titleTop = el('div', 'story-row__title-top');
    const icon = el('span', 'story-row__icon');
    icon.innerHTML = bookSvg;
    titleTop.append(icon, el('span', 'story-row__title-text', story.name));

    const createdDate = fmtDate(story.createdAt);
    const meta = el('div', 'story-row__meta');
    meta.append(el('span', 'story-row__meta-item', `Created by ${firstName} ${lastName}`));
    meta.append(el('span', 'story-row__meta-sep', '·'));
    meta.append(el('span', 'story-row__meta-item', createdDate));
    if (story.assigneeId) {
      const assignee = this.userService.getUserById(story.assigneeId);
      const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unknown user';
      meta.append(el('span', 'story-row__meta-sep', '·'));
      meta.append(el('span', 'story-row__meta-item story-row__assignee', `Assigned to ${assigneeName}`));
    }
    const taskCount = el('span', 'story-row__task-count', `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
    meta.append(el('span', 'story-row__meta-sep', '·'));
    meta.append(taskCount);
    titleCell.append(titleTop, meta);

    const priorityCell = el('span', 'story-col-priority');
    priorityCell.append(el('span', `priority-badge priority-badge--${story.priority}`, PRIORITY_LABELS[story.priority]));

    const stateBtn = el('button', 'story-col-state story-row__state');
    stateBtn.type = 'button';
    stateBtn.title = 'Click to advance state';
    stateBtn.append(el('span', `state-dot state-dot--${story.status}`), el('span', undefined, STORY_STATUS_LABELS[story.status]));
    stateBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cycleStoryStatus(story.id); });

    const actionsCell = el('div', 'story-col-actions story-row__actions');
    const editBtn = el('button', 'button button-icon button-icon--edit');
    editBtn.type = 'button';
    editBtn.title = 'Edit story';
    editBtn.setAttribute('aria-label', 'Edit story');
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.loadStoryForEdit(story.id); });
    const deleteBtn = el('button', 'button button-icon button-icon--delete');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete story';
    deleteBtn.setAttribute('aria-label', 'Delete story');
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeStory(story.id); });
    actionsCell.append(editBtn, deleteBtn);

    row.append(expandBtn, idCell, titleCell, priorityCell, stateBtn, actionsCell);

    // Expansion panel
    const expansion = el('div', `story-expansion${isExpanded ? '' : ' story-expansion--hidden'}`);
    const taskListEl = el('div', 'task-list');
    if (tasks.length === 0) {
      taskListEl.append(el('p', 'empty-state empty-state--sm', 'No tasks yet.'));
    } else {
      tasks.forEach((task) => taskListEl.append(this.buildTaskRow(task, story)));
    }

    const addTaskBar = el('div', 'task-add-bar');
    const addTaskBtn = el('button', 'button button-add-task', '+ Add task');
    addTaskBtn.type = 'button';
    addTaskBtn.addEventListener('click', () => this.openTaskForm(story.id));
    addTaskBar.append(addTaskBtn);
    expansion.append(taskListEl, addTaskBar);

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nowExpanded = expansion.classList.toggle('story-expansion--hidden');
      if (!nowExpanded) {
        this.expandedStoryIds.add(story.id);
        expandBtn.innerHTML = '&#9660;';
      } else {
        this.expandedStoryIds.delete(story.id);
        expandBtn.innerHTML = '&#9658;';
      }
    });

    group.append(row, expansion);
    return group;
  }

  private buildTaskRow(task: Task, story: Story): HTMLElement {
    const row = el('div', `task-row task-row--${task.status}`);

    const expandCell = el('span', 'story-col-expand');
    const idCell = el('span', 'story-col-id task-row__id', String(task.uid));

    const icon = el('span', 'task-row__icon');
    icon.innerHTML = TASK_ICON_SVG;

    const titleCell = el('div', 'task-row__title-cell');
    const titleTop = el('div', 'task-row__title-top');
    const nameLink = el('span', 'task-row__name', task.name);
    nameLink.addEventListener('click', () => this.showTaskDetail(task.id));

    const meta = el('div', 'task-row__meta');
    if (task.assigneeId) {
      const assignee = this.userService.getUserById(task.assigneeId);
      if (assignee) {
        meta.append(el('span', 'task-row__meta-item', `Assigned to ${assignee.firstName} ${assignee.lastName}`));
      }
    }
    titleTop.append(icon, nameLink);
    titleCell.append(titleTop);
    if (meta.childElementCount > 0) titleCell.append(meta);

    const priorityCell = el('span', 'task-row__priority');
    priorityCell.append(el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]));

    const statusCell = el('button', 'story-col-state task-row__status');
    statusCell.type = 'button';
    statusCell.title = 'Click to advance state';
    statusCell.append(el('span', `state-dot state-dot--${task.status}`), el('span', 'task-row__status-text', TASK_STATUS_LABELS[task.status]));
    statusCell.addEventListener('click', () => this.cycleTaskStatus(task.id));

    const actions = el('div', 'task-row__actions');

    const editBtn = el('button', 'button button-icon button-icon--edit');
    editBtn.type = 'button';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', () => this.openTaskForm(story.id, task.id));

    const deleteBtn = el('button', 'button button-icon button-icon--delete');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', () => this.deleteTask(task.id));

    actions.append(editBtn, deleteBtn);
    row.append(expandCell, idCell, titleCell, priorityCell, statusCell, actions);
    return row;
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

  // ─── Task form modal ──────────────────────────────────────────────────────────

  private buildTaskFormModal() {
    this.taskFormModal = el('div', 'modal-overlay modal-overlay--hidden');

    const dialog = el('div', 'modal-dialog');

    const modalHeader = el('div', 'modal-header');
    this.taskFormTitle = el('h3', 'modal-title', 'Add Task');
    const closeBtn = el('button', 'modal-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.closeTaskForm());
    modalHeader.append(this.taskFormTitle, closeBtn);

    const form = el('form', 'form-card modal-form');

    this.taskFormStorySelect = el('select');
    this.taskFormStorySelect.required = true;

    this.taskNameInput = el('input');
    this.taskNameInput.type = 'text';
    this.taskNameInput.placeholder = 'Task name';
    this.taskNameInput.required = true;

    this.taskDescInput = el('textarea');
    this.taskDescInput.placeholder = 'Task description';
    this.taskDescInput.rows = 3;
    this.taskDescInput.required = true;

    this.taskPrioritySelect = el('select');
    (['low', 'medium', 'high'] as TaskPriority[]).forEach((p) => {
      const opt = el('option');
      opt.value = p;
      opt.textContent = PRIORITY_LABELS[p];
      this.taskPrioritySelect.append(opt);
    });

    this.taskEstHoursInput = el('input');
    this.taskEstHoursInput.type = 'number';
    this.taskEstHoursInput.min = '0.5';
    this.taskEstHoursInput.step = '0.5';
    this.taskEstHoursInput.placeholder = 'e.g. 4';
    this.taskEstHoursInput.required = true;

    const row = el('div', 'form-card__row');
    row.append(
      this.createField('Priority', this.taskPrioritySelect),
      this.createField('Estimated hours', this.taskEstHoursInput),
    );

    this.taskFormSubmitBtn = el('button', 'button button-primary', 'Save');
    this.taskFormSubmitBtn.type = 'submit';
    const cancelBtn = el('button', 'button button-cancel', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => this.closeTaskForm());
    const actions = el('div', 'form-actions');
    actions.append(this.taskFormSubmitBtn, cancelBtn);

    form.append(
      this.createField('Story', this.taskFormStorySelect),
      this.createField('Name', this.taskNameInput),
      this.createField('Description', this.taskDescInput),
      row,
      actions,
    );
    form.addEventListener('submit', (e) => this.handleTaskFormSubmit(e));

    dialog.append(modalHeader, form);
    this.taskFormModal.append(dialog);

    this.taskFormModal.addEventListener('click', (e) => {
      if (e.target === this.taskFormModal) this.closeTaskForm();
    });
  }

  private openTaskForm(storyId?: string, taskId?: string) {
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) return;

    this.taskFormStorySelect.innerHTML = '';
    const stories = this.storyStorage.getAllByProject(activeId);
    stories.forEach((s) => {
      const opt = el('option');
      opt.value = s.id;
      opt.textContent = `#${s.uid} ${s.name}`;
      this.taskFormStorySelect.append(opt);
    });

    this.currentEditTaskId = taskId ?? null;
    this.taskFormContextStoryId = storyId ?? null;

    if (taskId) {
      const task = this.taskStorage.getById(taskId);
      if (!task) return;
      this.taskFormTitle.textContent = 'Edit Task';
      this.taskFormStorySelect.value = task.storyId;
      this.taskNameInput.value = task.name;
      this.taskDescInput.value = task.description;
      this.taskPrioritySelect.value = task.priority;
      this.taskEstHoursInput.value = String(task.estimatedHours);
      this.taskFormSubmitBtn.textContent = 'Update';
    } else {
      this.taskFormTitle.textContent = 'Add Task';
      this.taskNameInput.value = '';
      this.taskDescInput.value = '';
      this.taskPrioritySelect.value = 'medium';
      this.taskEstHoursInput.value = '';
      this.taskFormSubmitBtn.textContent = 'Save';
      if (storyId) this.taskFormStorySelect.value = storyId;
    }

    this.taskFormModal.classList.remove('modal-overlay--hidden');
  }

  private closeTaskForm() {
    this.taskFormModal.classList.add('modal-overlay--hidden');
    this.currentEditTaskId = null;
    this.taskFormContextStoryId = null;
  }

  private handleTaskFormSubmit(e: Event) {
    e.preventDefault();
    const storyId = this.taskFormStorySelect.value;
    const name = this.taskNameInput.value.trim();
    const description = this.taskDescInput.value.trim();
    const priority = this.taskPrioritySelect.value as TaskPriority;
    const estimatedHours = parseFloat(this.taskEstHoursInput.value);
    if (!storyId || !name || !description || isNaN(estimatedHours)) return;
    const editedTaskId = this.currentEditTaskId;

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
      this.closeTaskForm();
      this.refreshStories();
      if (this.currentDetailTab === 'kanban') this.refreshKanban();
      if (this.currentTaskDetailId === editedTaskId) this.renderTaskDetailContent();
    }
  }

  // ─── Task detail view ─────────────────────────────────────────────────────────

  private buildTaskDetailView() {
    this.taskDetailView = el('div', 'view view-task-detail view--hidden');

    const backBtn = el('button', 'button button-back');
    backBtn.type = 'button';
    this.taskDetailBackLabel = el('span', undefined, '← Back');
    backBtn.append(this.taskDetailBackLabel);
    backBtn.addEventListener('click', () => this.backFromTaskDetail());

    this.taskDetailContent = el('div', 'task-detail-content');
    this.taskDetailView.append(backBtn, this.taskDetailContent);
  }

  private showTaskDetail(taskId: string) {
    this.currentTaskDetailId = taskId;
    const task = this.taskStorage.getById(taskId);
    if (!task) return;
    this.taskDetailBackLabel.textContent = '← Back';
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.classList.remove('view--hidden');
    this.notifListView.classList.add('view--hidden');
    this.notifDetailView.classList.add('view--hidden');
    this.usersView.classList.add('view--hidden');
    this.renderTaskDetailContent();
  }

  private backFromTaskDetail() {
    this.taskDetailView.classList.add('view--hidden');
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

    this.taskDetailContent.innerHTML = '';

    // Header bar
    const headerBar = el('div', 'task-detail__header-bar');
    const uidBadge = el('span', 'task-detail__uid');
    uidBadge.innerHTML = `${TASK_ICON_SVG} #${task.uid}`;
    const priorityBadge = el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]);
    const statusBadge = el('span', `task-detail__status task-detail__status--${task.status}`, TASK_STATUS_LABELS[task.status]);
    headerBar.append(uidBadge, statusBadge, priorityBadge);

    // Title
    const titleEl = el('h2', 'task-detail__title', task.name);

    // Description
    const descEl = el('p', 'task-detail__desc', task.description);

    // Details grid
    const details = el('div', 'task-detail__details');

    const makeDetailRow = (label: string, value: string) => {
      const row = el('div', 'detail-row');
      row.append(el('span', 'detail-row__label', label), el('span', 'detail-row__value', value));
      return row;
    };

    details.append(makeDetailRow('Story', story ? story.name : '—'));
    details.append(makeDetailRow('Created', fmtDate(task.createdAt)));
    details.append(makeDetailRow('Started', fmtDate(task.startedAt)));
    details.append(makeDetailRow('Completed', fmtDate(task.completedAt)));

    const assigneeRow = el('div', 'detail-row');
    assigneeRow.append(el('span', 'detail-row__label', 'Assignee'));
    const assigneeValue = el('span', 'detail-row__value');
    const assignSelect = el('select', 'assign-select');
    const emptyOpt = el('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'Unassigned';
    assignSelect.append(emptyOpt);
    this.userService.getAssignableUsers().forEach((u) => {
      const opt = el('option');
      opt.value = u.id;
      opt.textContent = `${u.firstName} ${u.lastName} (${ROLE_LABELS[u.role]})`;
      if (u.id === task.assigneeId) opt.selected = true;
      assignSelect.append(opt);
    });
    assignSelect.addEventListener('change', () => {
      if (assignSelect.value) {
        this.assignUserToTask(task.id, assignSelect.value);
      } else {
        const saved = this.withStorage(() => this.taskStorage.update({ ...task, assigneeId: null }));
        if (saved) this.refreshAfterTaskChange(task.id);
      }
    });
    assigneeValue.append(assignSelect);
    assigneeRow.append(assigneeValue);
    details.append(assigneeRow);

    const estimatedRow = el('div', 'detail-row');
    estimatedRow.append(el('span', 'detail-row__label', 'Estimated'));
    const estimatedValWrap = el('span', 'detail-row__value detail-row__value--editable');
    const estimatedInput = el('input');
    estimatedInput.type = 'number';
    estimatedInput.min = '0.5';
    estimatedInput.step = '0.5';
    estimatedInput.value = String(task.estimatedHours);
    estimatedInput.className = 'actual-hours-input';
    estimatedInput.addEventListener('change', () => {
      const val = parseFloat(estimatedInput.value);
      if (isNaN(val)) return;
      const saved = this.withStorage(() => this.taskStorage.update({ ...task, estimatedHours: val }));
      if (saved) this.refreshAfterTaskChange(task.id);
    });
    estimatedValWrap.append(estimatedInput);
    estimatedRow.append(estimatedValWrap);
    details.append(estimatedRow);

    // Actual hours row (editable)
    const actualRow = el('div', 'detail-row');
    actualRow.append(el('span', 'detail-row__label', 'Actual hours'));
    const actualValWrap = el('span', 'detail-row__value detail-row__value--editable');
    const actualInput = el('input');
    actualInput.type = 'number';
    actualInput.min = '0';
    actualInput.step = '0.5';
    actualInput.value = task.actualHours !== null ? String(task.actualHours) : '';
    actualInput.className = 'actual-hours-input';
    actualInput.addEventListener('change', () => {
      const val = parseFloat(actualInput.value);
      const updated = { ...task, actualHours: isNaN(val) ? null : val };
      const saved = this.withStorage(() => this.taskStorage.update(updated));
      if (saved) this.refreshAfterTaskChange(task.id);
    });
    actualValWrap.append(actualInput);
    actualRow.append(actualValWrap);
    details.append(actualRow);

    const actionsSection = el('div', 'task-detail__section task-detail__actions-section');
    if (task.status !== 'done') {
      const doneBtn = el('button', 'button button-done', '✓ Mark as Done');
      doneBtn.type = 'button';
      doneBtn.addEventListener('click', () => this.completeTask(task.id));
      actionsSection.append(doneBtn);
    }

    this.taskDetailContent.append(headerBar, titleEl, descEl, details);
    if (actionsSection.childElementCount > 0) this.taskDetailContent.append(actionsSection);
  }

  // ─── Kanban board ─────────────────────────────────────────────────────────────

  private refreshKanban() {
    const activeId = this.projectStorage.getActiveProjectId();
    this.kanbanContent.innerHTML = '';
    if (!activeId) return;

    const stories = this.storyStorage.getAllByProject(activeId);
    const storyIds = stories.map((s) => s.id);
    const allTasks = this.taskStorage.getAllByStories(storyIds);

    const board = el('div', 'kanban-board');

    const statuses: TaskStatus[] = ['todo', 'doing', 'done'];
    const colTitles: Record<TaskStatus, string> = { todo: 'To Do', doing: 'Doing', done: 'Done' };

    statuses.forEach((status) => {
      const tasks = allTasks.filter((t) => t.status === status);
      const col = el('div', 'kanban-col');

      const colHeader = el('div', 'kanban-col__header');
      const colDot = el('span', `state-dot state-dot--${status}`);
      const colTitle = el('span', 'kanban-col__title', colTitles[status]);
      const colCount = el('span', 'kanban-col__count', String(tasks.length));
      colHeader.append(colDot, colTitle, colCount);
      col.append(colHeader);

      const cardList = el('div', 'kanban-cards');
      if (tasks.length === 0) {
        cardList.append(el('p', 'empty-state empty-state--sm', 'No tasks'));
      } else {
        tasks.forEach((task) => {
          const story = stories.find((s) => s.id === task.storyId);
          cardList.append(this.buildKanbanCard(task, story));
        });
      }
      col.append(cardList);
      board.append(col);
    });

    this.kanbanContent.append(board);
  }

  private buildKanbanCard(task: Task, story: Story | undefined): HTMLElement {
    const card = el('div', `kanban-card kanban-card--${task.status}`);
    card.addEventListener('click', () => this.showTaskDetail(task.id));

    const cardTop = el('div', 'kanban-card__top');
    const taskIconEl = el('span', 'kanban-card__icon');
    taskIconEl.innerHTML = TASK_ICON_SVG;
    const uidEl = el('span', 'kanban-card__uid', `#${task.uid}`);
    cardTop.append(taskIconEl, uidEl);

    const name = el('p', 'kanban-card__name', task.name);

    const storyLabel = el('span', 'kanban-card__story', story ? `${story.name}` : '—');

    const cardBottom = el('div', 'kanban-card__bottom');
    cardBottom.append(el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]));

    if (task.assigneeId) {
      const assignee = this.userService.getUserById(task.assigneeId);
      if (assignee) {
        const av = el('span', 'user-avatar user-avatar--xs', `${assignee.firstName[0]}${assignee.lastName[0]}`);
        cardBottom.append(av);
      }
    }

    card.append(cardTop, name, storyLabel, cardBottom);
    return card;
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  private refresh() {
    this.refreshProjects();
    this.refreshStories();
    this.refreshNotifBadge();
  }

  private refreshProjects() {
    const projects = this.projectStorage.getAll();
    const activeId = this.projectStorage.getActiveProjectId();

    this.projectListContainer.innerHTML = '';

    if (projects.length === 0) {
      const isFormOpen = !this.projectFormWrapper.classList.contains('form-wrapper--hidden');
      if (!isFormOpen) {
        this.projectListContainer.append(el('p', 'empty-state', 'No projects yet. Add your first project.'));
      }
      return;
    }

    const list = el('div', 'projects-list');
    projects
      .filter((p) => p.id !== this.currentEditProjectId)
      .forEach((project) => this.buildProjectCard(project, activeId, list));
    this.projectListContainer.append(list);
  }

  private buildProjectCard(project: Project, activeId: string | null, container: HTMLElement) {
    const isActive = project.id === activeId;
    const card = el('article', `project-card${isActive ? ' project-card--active' : ''}`);
    card.addEventListener('click', () => this.showProjectDetail(project.id));

    const content = el('div', 'project-card__content');
    const titleRow = el('div', 'project-card__top');
    const title = el('h3', 'project-card__title', project.name);
    titleRow.append(title);
    if (isActive) titleRow.append(el('span', 'active-badge', 'Active'));
    const desc = el('p', 'project-card__desc', project.description);
    content.append(titleRow, desc);

    const actions = el('div', 'project-actions');

    const editBtn = el('button', 'button button-icon button-icon--edit');
    editBtn.type = 'button';
    editBtn.title = 'Edit project';
    editBtn.setAttribute('aria-label', 'Edit project');
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); this.loadProjectForEdit(project.id); });

    const deleteBtn = el('button', 'button button-icon button-icon--delete');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete project';
    deleteBtn.setAttribute('aria-label', 'Delete project');
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeProject(project.id); });

    actions.append(editBtn, deleteBtn);
    card.append(content, actions);
    container.append(card);
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

  // ─── Notifications: build views ───────────────────────────────────────────────

  private buildNotifListView(): void {
    this.notifListView = el('div', 'view view-notif-list view--hidden');

    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.backFromNotifList());

    const header = el('div', 'notif-list-header');
    const title = el('h2', undefined, 'Notifications');
    const markAllBtn = el('button', 'button button-cancel', 'Mark all as read');
    markAllBtn.type = 'button';
    markAllBtn.addEventListener('click', () => {
      this.notificationStorage.markAllRead(this.userService.getLoggedUser().id);
      this.refreshNotifBadge();
      this.renderNotifList();
    });
    header.append(title, markAllBtn);

    this.notifListContainer = el('div', 'notif-list');
    this.notifListView.append(backBtn, header, this.notifListContainer);
  }

  private buildNotifDetailView(): void {
    this.notifDetailView = el('div', 'view view-notif-detail view--hidden');

    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.backFromNotifDetail());

    this.notifDetailContentEl = el('div', 'notif-detail-content');
    this.notifDetailView.append(backBtn, this.notifDetailContentEl);
  }

  private buildNotifDialog(): void {
    this.notifDialog = el('div', 'notif-dialog-container notif-dialog--hidden');

    const box = el('div', 'notif-dialog-box');

    const dialogHeader = el('div', 'notif-dialog__header');
    this.notifDialogPriority = el('span', 'priority-badge');
    const closeBtn = el('button', 'modal-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.dismissNotifDialog());
    dialogHeader.append(this.notifDialogPriority, closeBtn);

    this.notifDialogTitle = el('h3', 'notif-dialog__title');
    this.notifDialogMessage = el('p', 'notif-dialog__message');

    const dialogActions = el('div', 'notif-dialog__actions');
    this.notifDialogViewBtn = el('button', 'button button-primary', 'View');
    this.notifDialogViewBtn.type = 'button';
    const dismissBtn = el('button', 'button button-cancel', 'Dismiss');
    dismissBtn.type = 'button';
    dismissBtn.addEventListener('click', () => this.dismissNotifDialog());
    dialogActions.append(this.notifDialogViewBtn, dismissBtn);

    box.append(dialogHeader, this.notifDialogTitle, this.notifDialogMessage, dialogActions);
    this.notifDialog.append(box);
  }

  // ─── Notifications: navigation ────────────────────────────────────────────────

  private showNotifList(): void {
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.classList.add('view--hidden');
    this.notifDetailView.classList.add('view--hidden');
    this.usersView.classList.add('view--hidden');
    this.notifListView.classList.remove('view--hidden');
    this.renderNotifList();
  }

  private showNotifDetail(id: string): void {
    this.currentNotifId = id;
    this.notificationStorage.markRead(id);
    this.refreshNotifBadge();
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.classList.add('view--hidden');
    this.notifListView.classList.add('view--hidden');
    this.usersView.classList.add('view--hidden');
    this.notifDetailView.classList.remove('view--hidden');
    this.renderNotifDetail(id);
  }

  private backFromNotifList(): void {
    this.notifListView.classList.add('view--hidden');
    this.restorePreviousView();
  }

  private backFromNotifDetail(): void {
    this.notifDetailView.classList.add('view--hidden');
    this.notifListView.classList.remove('view--hidden');
    this.renderNotifList();
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

  // ─── Notifications: rendering ─────────────────────────────────────────────────

  private renderNotifList(): void {
    const user = this.userService.getLoggedUser();
    const notifs = this.notificationStorage.getByRecipient(user.id);
    this.notifListContainer.innerHTML = '';

    if (notifs.length === 0) {
      this.notifListContainer.append(el('p', 'empty-state', 'No notifications yet.'));
      return;
    }

    notifs.forEach((notif) => {
      const item = el('div', `notif-item${notif.isRead ? '' : ' notif-item--unread'}`);

      const dot = el('span', `notif-item__dot${notif.isRead ? ' notif-item__dot--read' : ''}`);

      const body = el('div', 'notif-item__body');
      const header = el('div', 'notif-item__header');
      header.append(
        el('span', 'notif-item__title', notif.title),
        el('span', `priority-badge priority-badge--${notif.priority}`, PRIORITY_LABELS[notif.priority]),
        el('span', 'notif-item__date', fmtDateTime(notif.date)),
      );

      const message = el('p', 'notif-item__message', notif.message);
      body.append(header, message);

      if (!notif.isRead) {
        const actions = el('div', 'notif-item__actions');
        const markReadBtn = el('button', 'button button-cancel notif-item__mark-read', 'Mark as read');
        markReadBtn.type = 'button';
        markReadBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.notificationStorage.markRead(notif.id);
          this.refreshNotifBadge();
          this.renderNotifList();
        });
        actions.append(markReadBtn);
        body.append(actions);
      }

      item.append(dot, body);
      item.addEventListener('click', () => this.showNotifDetail(notif.id));
      this.notifListContainer.append(item);
    });
  }

  private renderNotifDetail(id: string): void {
    const notif = this.notificationStorage.getById(id);
    this.notifDetailContentEl.innerHTML = '';

    if (!notif) {
      this.notifDetailContentEl.append(el('p', 'empty-state', 'Notification not found.'));
      return;
    }

    const header = el('div', 'notif-detail__header');
    header.append(
      el('h2', 'notif-detail__title', notif.title),
      el('span', `priority-badge priority-badge--${notif.priority}`, PRIORITY_LABELS[notif.priority]),
    );

    const meta = el('div', 'notif-detail__meta');
    meta.append(
      el('span', 'notif-detail__date', fmtDateTime(notif.date)),
      el('span', `notif-detail__status notif-detail__status--${notif.isRead ? 'read' : 'unread'}`, notif.isRead ? 'Read' : 'Unread'),
    );

    const message = el('p', 'notif-detail__message', notif.message);
    this.notifDetailContentEl.append(header, meta, message);
  }

  // ─── Notifications: send + badge + dialog ─────────────────────────────────────

  private sendNotification(data: Omit<AppNotification, 'id' | 'date' | 'isRead'>): void {
    const notif = this.notificationStorage.create(data);
    const currentUser = this.userService.getLoggedUser();
    if (notif.recipientId === currentUser.id) {
      this.refreshNotifBadge();
      if (notif.priority === 'medium' || notif.priority === 'high') {
        this.notifDialogQueue.push(notif);
        if (!this.notifDialogActive) this.processNotifDialogQueue();
      }
    }
  }

  private refreshNotifBadge(): void {
    const count = this.notificationStorage.getUnreadCount(this.userService.getLoggedUser().id);
    this.notifBadge.classList.toggle('notif-bell-dot--hidden', count === 0);
  }

  private processNotifDialogQueue(): void {
    if (this.notifDialogQueue.length === 0) {
      this.notifDialogActive = false;
      return;
    }
    this.notifDialogActive = true;
    const notif = this.notifDialogQueue.shift()!;
    this.notifDialogTitle.textContent = notif.title;
    this.notifDialogMessage.textContent = notif.message;
    this.notifDialogPriority.textContent = PRIORITY_LABELS[notif.priority];
    this.notifDialogPriority.className = `priority-badge priority-badge--${notif.priority}`;
    this.notifDialogViewBtn.onclick = () => {
      this.dismissNotifDialog();
      this.showNotifDetail(notif.id);
    };
    this.notifDialog.classList.remove('notif-dialog--hidden');
  }

  private dismissNotifDialog(): void {
    this.notifDialog.classList.add('notif-dialog--hidden');
    setTimeout(() => this.processNotifDialogQueue(), 300);
  }

  // ─── Users management view ────────────────────────────────────────────────────

  private buildUsersView(): void {
    this.usersView = el('div', 'view view-users view--hidden');

    const backBtn = el('button', 'button button-back', '← Back');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.backFromUsersView());

    const header = el('div', 'notif-list-header');
    header.append(el('h2', undefined, 'User Management'));

    this.usersListContent = el('div', 'users-list');
    this.usersView.append(backBtn, header, this.usersListContent);
  }

  private showUsersView(): void {
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.taskDetailView.classList.add('view--hidden');
    this.notifListView.classList.add('view--hidden');
    this.notifDetailView.classList.add('view--hidden');
    this.usersView.classList.remove('view--hidden');
    this.renderUsersList();
  }

  private backFromUsersView(): void {
    this.usersView.classList.add('view--hidden');
    this.restorePreviousView();
  }

  private renderUsersList(): void {
    const users = this.userService.getAllUsers();
    const currentUser = this.userService.getLoggedUser();
    this.usersListContent.innerHTML = '';

    if (users.length === 0) {
      this.usersListContent.append(el('p', 'empty-state', 'No users yet.'));
      return;
    }

    const roles: UserRole[] = ['admin', 'devops', 'developer', 'guest'];

    users.forEach((u) => {
      const isSelf = u.id === currentUser.id;
      const row = el('div', `user-mgmt-row${u.isBlocked ? ' user-mgmt-row--blocked' : ''}`);

      const avatarEl = el('span', 'user-avatar user-avatar--sm', `${u.firstName[0]}${u.lastName[0]}`);

      const info = el('div', 'user-mgmt-info');
      info.append(el('span', 'user-mgmt-name', `${u.firstName} ${u.lastName}`));
      info.append(el('span', 'user-mgmt-email', u.email));

      const roleSelect = el('select', 'user-mgmt-role-select');
      roles.forEach((r) => {
        const opt = el('option');
        opt.value = r;
        opt.textContent = ROLE_LABELS[r];
        if (r === u.role) opt.selected = true;
        roleSelect.append(opt);
      });
      roleSelect.disabled = isSelf;
      roleSelect.addEventListener('change', () => {
        this.userService.updateUser({ ...u, role: roleSelect.value as UserRole });
        this.renderUsersList();
      });

      const blockBtn = el('button', `button ${u.isBlocked ? 'user-mgmt-btn--unblock' : 'user-mgmt-btn--block'}`, u.isBlocked ? 'Unblock' : 'Block');
      blockBtn.type = 'button';
      blockBtn.disabled = isSelf;
      blockBtn.addEventListener('click', () => {
        this.userService.updateUser({ ...u, isBlocked: !u.isBlocked });
        this.renderUsersList();
      });

      row.append(avatarEl, info, roleSelect, blockBtn);
      this.usersListContent.append(row);
    });
  }
}
