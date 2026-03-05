import { Project, ProjectStorage } from './api/projectStorage';
import { Story, StoryStatus, Priority } from './models/Story';
import { StoryStorage } from './api/storyStorage';
import { UserService } from './api/userService';
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

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const STATUS_LABELS: Record<StoryStatus, string> = {
  todo: 'New',
  doing: 'In Progress',
  done: 'Done',
};

export class App {
  private projectStorage = new ProjectStorage();
  private storyStorage = new StoryStorage();
  private userService = UserService.getInstance();
  private root: HTMLElement;
  private fieldIdCounter = 0;

  // Views
  private mainView!: HTMLElement;
  private detailSection!: HTMLElement;
  private detailProjectTitle!: HTMLHeadingElement;
  private detailProjectDesc!: HTMLElement;

  // Project form
  private currentEditProjectId: string | null = null;
  private projectFormWrapper!: HTMLElement;
  private projectForm!: HTMLFormElement;
  private projectNameInput!: HTMLInputElement;
  private projectDescInput!: HTMLTextAreaElement;
  private projectSubmitBtn!: HTMLButtonElement;
  private projectListContainer!: HTMLElement;

  // Story form
  private storiesSection!: HTMLElement;
  private storyList!: HTMLElement;
  private storyFormWrapper!: HTMLElement;
  private currentEditStoryId: string | null = null;
  private storyForm!: HTMLFormElement;
  private storyNameInput!: HTMLInputElement;
  private storyDescInput!: HTMLTextAreaElement;
  private storyPrioritySelect!: HTMLSelectElement;
  private storyStatusSelect!: HTMLSelectElement;
  private storyAssigneeSelect!: HTMLSelectElement;
  private storySubmitBtn!: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app-shell';
    this.buildUI();
    this.refresh();
  }

  private buildUI() {
    this.mainView = el('div', 'view view-main');
    this.mainView.append(this.buildProjectsSection());

    this.detailSection = el('div', 'view view-detail view--hidden');
    const backBtn = el('button', 'button button-back', '← Back to Projects');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => this.showMainView());

    const detailProjectHeader = el('div', 'detail-project-header');
    this.detailProjectTitle = el('h2', 'detail-project-title');
    this.detailProjectDesc = el('p', 'detail-project-desc');
    detailProjectHeader.append(this.detailProjectTitle, this.detailProjectDesc);

    this.detailSection.append(backBtn, detailProjectHeader, this.buildStoriesSection());

    this.root.append(this.buildHeader(), this.mainView, this.detailSection);
  }

  // ─── Header ──────────────────────────────────────────────────────────────────

  private buildHeader(): HTMLElement {
    const user = this.userService.getLoggedUser();
    const header = el('header', 'app-header');

    const brand = el('div', 'app-header__brand');
    const h1 = el('h1');
    h1.textContent = 'ManageMe';
    brand.append(h1);

    const userInfo = el('div', 'app-header__user');
    const avatar = el('span', 'user-avatar', `${user.firstName[0]}${user.lastName[0]}`);
    const name = el('span', 'user-name', `${user.firstName} ${user.lastName}`);
    userInfo.append(avatar, name);

    header.append(brand, userInfo);
    return header;
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

    if (this.currentEditProjectId) {
      this.projectStorage.update({ id: this.currentEditProjectId, name, description });
    } else {
      this.projectStorage.create({ name, description });
    }
    this.cancelProjectForm(); // calls refreshProjects() internally
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
    this.storyStorage.deleteByProject(id);
    this.projectStorage.delete(id);
    if (this.projectStorage.getActiveProjectId() === id) {
      this.projectStorage.setActiveProjectId(null);
    }
    if (this.currentEditProjectId === id) {
      this.closeProjectForm();
    }
    this.refresh();
  }

  // ─── Project detail page ──────────────────────────────────────────────────────

  private showProjectDetail(id: string) {
    const project = this.projectStorage.getById(id);
    if (!project) return;
    this.projectStorage.setActiveProjectId(id);
    this.detailProjectTitle.textContent = project.name;
    this.detailProjectDesc.textContent = project.description;
    this.mainView.classList.add('view--hidden');
    this.detailSection.classList.remove('view--hidden');
    this.cancelStoryForm();
    this.refreshStories();
  }

  private showMainView() {
    this.mainView.classList.remove('view--hidden');
    this.detailSection.classList.add('view--hidden');
    this.refresh();
  }

  // ─── Stories section ──────────────────────────────────────────────────────────

  private buildStoriesSection(): HTMLElement {
    this.storiesSection = el('section', 'stories-section stories-section--hidden');

    const titleBar = el('div', 'section-title-bar');
    const h2 = el('h2', undefined, 'Stories');
    const addBtn = el('button', 'button button-primary', '+ Add story');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => this.toggleStoryForm());
    titleBar.append(h2, addBtn);

    this.storyFormWrapper = el('div', 'form-wrapper form-wrapper--hidden');
    this.storyForm = el('form', 'form-card');

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
      opt.textContent = STATUS_LABELS[s];
      this.storyStatusSelect.append(opt);
    });

    const user = this.userService.getLoggedUser();
    this.storyAssigneeSelect = el('select');
    const unassignedOpt = el('option');
    unassignedOpt.value = '';
    unassignedOpt.textContent = 'Unassigned';
    const userOpt = el('option');
    userOpt.value = user.id;
    userOpt.textContent = `${user.firstName} ${user.lastName}`;
    this.storyAssigneeSelect.append(unassignedOpt, userOpt);

    this.storySubmitBtn = el('button', 'button button-primary', 'Save');
    this.storySubmitBtn.type = 'submit';
    const cancelStoryBtn = el('button', 'button button-cancel', 'Cancel');
    cancelStoryBtn.type = 'button';
    cancelStoryBtn.addEventListener('click', () => this.cancelStoryForm());
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
    this.storyFormWrapper.append(this.storyForm);

    this.storyList = el('div', 'story-list');
    this.storiesSection.append(titleBar, this.storyFormWrapper, this.storyList);
    return this.storiesSection;
  }

  private toggleStoryForm(forceOpen = false) {
    const isHidden = this.storyFormWrapper.classList.contains('form-wrapper--hidden');
    if (isHidden || forceOpen) {
      this.storyFormWrapper.classList.remove('form-wrapper--hidden');
    } else {
      this.cancelStoryForm();
    }
  }

  private cancelStoryForm() {
    this.storyFormWrapper.classList.add('form-wrapper--hidden');
    this.storyForm.reset();
    this.currentEditStoryId = null;
    this.storySubmitBtn.textContent = 'Save';
  }

  private handleStorySubmit(e: Event) {
    e.preventDefault();
    const activeId = this.projectStorage.getActiveProjectId();
    if (!activeId) return;

    const user = this.userService.getLoggedUser();
    const name = this.storyNameInput.value.trim();
    const description = this.storyDescInput.value.trim();
    const priority = this.storyPrioritySelect.value as Priority;
    const status = this.storyStatusSelect.value as StoryStatus;
    const assigneeId = this.storyAssigneeSelect.value || null;
    if (!name || !description) return;

    if (this.currentEditStoryId) {
      const existing = this.storyStorage.getById(this.currentEditStoryId);
      if (existing) {
        this.storyStorage.update({ ...existing, name, description, priority, status, assigneeId });
      }
    } else {
      this.storyStorage.create({ name, description, priority, status, assigneeId, projectId: activeId, ownerId: user.id });
    }
    this.cancelStoryForm();
    this.refreshStories();
  }

  private loadStoryForEdit(id: string) {
    const story = this.storyStorage.getById(id);
    if (!story) return;
    this.currentEditStoryId = id;
    this.storyNameInput.value = story.name;
    this.storyDescInput.value = story.description;
    this.storyPrioritySelect.value = story.priority;
    this.storyStatusSelect.value = story.status;
    this.storyAssigneeSelect.value = story.assigneeId ?? '';
    this.storySubmitBtn.textContent = 'Update';
    this.toggleStoryForm(true);
    this.storyFormWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private removeStory(id: string) {
    if (!confirm('Are you sure you want to delete this story?')) return;
    if (this.currentEditStoryId === id) this.cancelStoryForm();
    this.storyStorage.delete(id);
    this.refreshStories();
  }

  private cycleStoryStatus(id: string) {
    const story = this.storyStorage.getById(id);
    if (!story) return;
    const cycle: StoryStatus[] = ['todo', 'doing', 'done'];
    const next = cycle[(cycle.indexOf(story.status) + 1) % cycle.length];
    this.storyStorage.update({ ...story, status: next });
    this.refreshStories();
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  private refresh() {
    this.refreshProjects();
    this.refreshStories();
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

    const user = this.userService.getLoggedUser();
    const stories = this.storyStorage.getAllByProject(activeId);
    this.storyList.innerHTML = '';

    if (stories.length === 0) {
      this.storyList.append(el('p', 'empty-state', 'No stories yet. Add your first story.'));
      return;
    }

    const table = el('div', 'story-table');

    const header = el('div', 'story-table__header');
    header.append(
      el('span', 'story-col-id', 'ID'),
      el('span', 'story-col-title', 'Title'),
      el('span', 'story-col-priority', 'Priority'),
      el('span', 'story-col-state', 'State'),
      el('span', 'story-col-actions'),
    );
    table.append(header);

    stories.forEach((story) => table.append(this.buildStoryRow(story, user.firstName, user.lastName)));
    this.storyList.append(table);
  }

  private buildStoryRow(story: Story, firstName: string, lastName: string): HTMLElement {
    const row = el('div', `story-row story-row--${story.status}`);

    // ID
    const idCell = el('span', 'story-col-id story-row__id', String(story.uid));

    // Title + meta (owner + assignee)
    const titleCell = el('div', 'story-col-title story-row__title-cell');
    const titleTop = el('div', 'story-row__title-top');
    const icon = el('span', 'story-row__icon');
    icon.innerHTML = bookSvg;
    titleTop.append(icon, el('span', 'story-row__title-text', story.name));
    const createdDate = new Date(story.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
    titleCell.append(titleTop, meta);

    // Priority badge
    const priorityCell = el('span', 'story-col-priority');
    priorityCell.append(el('span', `priority-badge priority-badge--${story.priority}`, PRIORITY_LABELS[story.priority]));

    // State
    const stateBtn = el('button', 'story-col-state story-row__state');
    stateBtn.type = 'button';
    stateBtn.title = 'Click to advance state';
    stateBtn.append(el('span', `state-dot state-dot--${story.status}`), el('span', undefined, STATUS_LABELS[story.status]));
    stateBtn.addEventListener('click', (e) => { e.stopPropagation(); this.cycleStoryStatus(story.id); });

    // Actions
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

    row.append(idCell, titleCell, priorityCell, stateBtn, actionsCell);
    return row;
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
}
