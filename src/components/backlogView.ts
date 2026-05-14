import type { Priority, Story, StoryStatus } from '../models/Story';
import type { Task } from '../models/Task';
import type { User } from '../models/User';
import { el, testId } from '../ui/dom';
import { fmtDate } from '../ui/format';
import { TASK_ICON_SVG } from '../ui/icons';
import { PRIORITY_LABELS, STORY_STATUS_LABELS, TASK_STATUS_LABELS } from '../ui/labels';
import trashSvg from '../assets/icons/trash.svg?raw';
import editSvg from '../assets/icons/edit.svg?raw';
import bookSvg from '../assets/icons/book.svg?raw';

export type StoryFormPayload = {
  editStoryId: string | null;
  name: string;
  description: string;
  priority: Priority;
  status: StoryStatus;
  assigneeId: string | null;
};

type BacklogViewOptions = {
  createField: (labelText: string, input: HTMLElement) => HTMLElement;
  getSelectableUsers: () => User[];
  getUserById: (id: string) => User | undefined;
  getStoryById: (id: string) => Story | undefined;
  onSubmitStory: (payload: StoryFormPayload) => void;
  onDeleteStory: (storyId: string) => void;
  onCycleStoryStatus: (storyId: string) => void;
  onAddTask: (storyId: string) => void;
  onEditTask: (storyId: string, taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onCycleTaskStatus: (taskId: string) => void;
  onShowTaskDetail: (taskId: string) => void;
};

type RenderBacklogOptions = {
  activeProjectExists: boolean;
  stories: Story[];
  tasksByStoryId: Map<string, Task[]>;
};

export class BacklogView {
  readonly element: HTMLElement;
  private readonly options: BacklogViewOptions;
  private readonly expandedStoryIds = new Set<string>();
  private currentEditStoryId: string | null = null;
  private storyList: HTMLElement;
  private storyFormWrapper: HTMLElement;
  private storyFormTitle: HTMLElement;
  private storyForm: HTMLFormElement;
  private storyNameInput: HTMLInputElement;
  private storyDescInput: HTMLTextAreaElement;
  private storyPrioritySelect: HTMLSelectElement;
  private storyStatusSelect: HTMLSelectElement;
  private storyAssigneeSelect: HTMLSelectElement;
  private storySubmitBtn: HTMLButtonElement;

  constructor(options: BacklogViewOptions) {
    this.options = options;
    this.element = el('section', 'stories-section stories-section--hidden');

    const titleBar = el('div', 'section-title-bar');
    const h2 = el('h2', undefined, 'Stories');
    const addBtn = testId(el('button', 'button button-primary', '+ Add story'), 'add-story-button');
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

    this.storyForm = testId(el('form', 'form-card modal-form'), 'story-form');
    this.storyNameInput = testId(el('input'), 'story-title-input');
    this.storyNameInput.type = 'text';
    this.storyNameInput.placeholder = 'Story title';
    this.storyNameInput.required = true;

    this.storyDescInput = testId(el('textarea'), 'story-description-input');
    this.storyDescInput.placeholder = 'Story description';
    this.storyDescInput.rows = 3;
    this.storyDescInput.required = true;

    this.storyPrioritySelect = testId(el('select'), 'story-priority-select');
    (['low', 'medium', 'high'] as Priority[]).forEach((p) => {
      const opt = el('option');
      opt.value = p;
      opt.textContent = PRIORITY_LABELS[p];
      this.storyPrioritySelect.append(opt);
    });

    this.storyStatusSelect = testId(el('select'), 'story-status-select');
    (['todo', 'doing', 'done'] as StoryStatus[]).forEach((s) => {
      const opt = el('option');
      opt.value = s;
      opt.textContent = STORY_STATUS_LABELS[s];
      this.storyStatusSelect.append(opt);
    });

    this.storyAssigneeSelect = testId(el('select'), 'story-assignee-select');

    this.storySubmitBtn = testId(el('button', 'button button-primary', 'Save'), 'story-submit-button');
    this.storySubmitBtn.type = 'submit';
    const cancelStoryBtn = el('button', 'button button-cancel', 'Cancel');
    cancelStoryBtn.type = 'button';
    cancelStoryBtn.addEventListener('click', () => this.closeStoryForm());
    const storyFormActions = el('div', 'form-actions');
    storyFormActions.append(this.storySubmitBtn, cancelStoryBtn);

    const storyFormRow = el('div', 'form-card__row');
    storyFormRow.append(
      this.options.createField('Priority', this.storyPrioritySelect),
      this.options.createField('Status', this.storyStatusSelect),
      this.options.createField('Assignee', this.storyAssigneeSelect),
    );

    this.storyForm.append(
      this.options.createField('Title', this.storyNameInput),
      this.options.createField('Description', this.storyDescInput),
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
    this.element.append(titleBar, this.storyFormWrapper, this.storyList);
  }

  render({ activeProjectExists, stories, tasksByStoryId }: RenderBacklogOptions): void {
    if (!activeProjectExists) {
      this.element.classList.add('stories-section--hidden');
      return;
    }

    this.element.classList.remove('stories-section--hidden');
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
      table.append(this.buildStoryGroup(story, tasksByStoryId.get(story.id) ?? []));
    });
    this.storyList.append(table);
  }

  closeStoryForm(): void {
    this.storyFormWrapper.classList.add('modal-overlay--hidden');
    this.storyForm.reset();
    this.currentEditStoryId = null;
    this.storySubmitBtn.textContent = 'Save';
  }

  clearEditingIfStory(storyId: string): void {
    if (this.currentEditStoryId === storyId) this.closeStoryForm();
  }

  private openStoryForm(id?: string): void {
    this.currentEditStoryId = id ?? null;
    this.storyForm.reset();
    this.rebuildAssigneeOptions();

    if (id) {
      const story = this.options.getStoryById(id);
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

  private rebuildAssigneeOptions(): void {
    this.storyAssigneeSelect.innerHTML = '';
    const unassignedOpt = el('option');
    unassignedOpt.value = '';
    unassignedOpt.textContent = 'Unassigned';
    this.storyAssigneeSelect.append(unassignedOpt);

    this.options.getSelectableUsers().forEach((u) => {
      const opt = el('option');
      opt.value = u.id;
      opt.textContent = `${u.firstName} ${u.lastName}`;
      this.storyAssigneeSelect.append(opt);
    });
  }

  private handleStorySubmit(e: Event): void {
    e.preventDefault();
    const name = this.storyNameInput.value.trim();
    const description = this.storyDescInput.value.trim();
    if (!name || !description) return;

    this.options.onSubmitStory({
      editStoryId: this.currentEditStoryId,
      name,
      description,
      priority: this.storyPrioritySelect.value as Priority,
      status: this.storyStatusSelect.value as StoryStatus,
      assigneeId: this.storyAssigneeSelect.value || null,
    });
  }

  private buildStoryGroup(story: Story, tasks: Task[]): HTMLElement {
    const owner = this.options.getUserById(story.ownerId);
    const firstName = owner?.firstName ?? 'Unknown';
    const lastName = owner?.lastName ?? '';
    const group = testId(el('div', 'story-group'), 'story-group');

    const isExpanded = this.expandedStoryIds.has(story.id);
    const expandBtn = testId(el('button', 'expand-btn'), 'story-expand-button');
    expandBtn.type = 'button';
    expandBtn.title = isExpanded ? 'Collapse' : 'Expand tasks';
    expandBtn.innerHTML = isExpanded ? '&#9660;' : '&#9658;';
    if (tasks.length === 0) expandBtn.classList.add('expand-btn--empty');

    const row = testId(el('div', `story-row story-row--${story.status}`), 'story-row');
    const idCell = el('span', 'story-col-id story-row__id', String(story.uid));
    const titleCell = el('div', 'story-col-title story-row__title-cell');
    const titleTop = el('div', 'story-row__title-top');
    const icon = el('span', 'story-row__icon');
    icon.innerHTML = bookSvg;
    titleTop.append(icon, el('span', 'story-row__title-text', story.name));

    const meta = el('div', 'story-row__meta');
    meta.append(el('span', 'story-row__meta-item', `Created by ${firstName} ${lastName}`));
    meta.append(el('span', 'story-row__meta-sep', '·'));
    meta.append(el('span', 'story-row__meta-item', fmtDate(story.createdAt)));
    if (story.assigneeId) {
      const assignee = this.options.getUserById(story.assigneeId);
      const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unknown user';
      meta.append(el('span', 'story-row__meta-sep', '·'));
      meta.append(el('span', 'story-row__meta-item story-row__assignee', `Assigned to ${assigneeName}`));
    }
    meta.append(el('span', 'story-row__meta-sep', '·'));
    meta.append(el('span', 'story-row__task-count', `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`));
    titleCell.append(titleTop, meta);

    const priorityCell = el('span', 'story-col-priority');
    priorityCell.append(el('span', `priority-badge priority-badge--${story.priority}`, PRIORITY_LABELS[story.priority]));

    const stateBtn = testId(el('button', 'story-col-state story-row__state'), 'story-status-button');
    stateBtn.type = 'button';
    stateBtn.title = 'Click to advance state';
    stateBtn.append(el('span', `state-dot state-dot--${story.status}`), el('span', undefined, STORY_STATUS_LABELS[story.status]));
    stateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onCycleStoryStatus(story.id);
    });

    const actionsCell = el('div', 'story-col-actions story-row__actions');
    const editBtn = testId(el('button', 'button button-icon button-icon--edit'), 'edit-story-button');
    editBtn.type = 'button';
    editBtn.title = 'Edit story';
    editBtn.setAttribute('aria-label', 'Edit story');
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openStoryForm(story.id);
    });
    const deleteBtn = testId(el('button', 'button button-icon button-icon--delete'), 'delete-story-button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete story';
    deleteBtn.setAttribute('aria-label', 'Delete story');
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onDeleteStory(story.id);
    });
    actionsCell.append(editBtn, deleteBtn);
    row.append(expandBtn, idCell, titleCell, priorityCell, stateBtn, actionsCell);

    const expansion = el('div', `story-expansion${isExpanded ? '' : ' story-expansion--hidden'}`);
    const taskListEl = el('div', 'task-list');
    tasks.forEach((task) => taskListEl.append(this.buildTaskRow(task, story)));

    const addTaskBar = el('div', 'task-add-bar');
    const addTaskBtn = testId(el('button', 'button button-add-task', '+ Add task'), 'add-task-button');
    addTaskBtn.type = 'button';
    addTaskBtn.addEventListener('click', () => this.options.onAddTask(story.id));
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
    const row = testId(el('div', `task-row task-row--${task.status}`), 'task-row');
    const expandCell = el('span', 'story-col-expand');
    const idCell = el('span', 'story-col-id task-row__id', String(task.uid));
    const icon = el('span', 'task-row__icon');
    icon.innerHTML = TASK_ICON_SVG;
    const titleCell = el('div', 'task-row__title-cell');
    const titleTop = el('div', 'task-row__title-top');
    const nameLink = el('span', 'task-row__name', task.name);
    nameLink.addEventListener('click', () => this.options.onShowTaskDetail(task.id));

    const meta = el('div', 'task-row__meta');
    if (task.assigneeId) {
      const assignee = this.options.getUserById(task.assigneeId);
      if (assignee) {
        meta.append(el('span', 'task-row__meta-item', `Assigned to ${assignee.firstName} ${assignee.lastName}`));
      }
    }
    titleTop.append(icon, nameLink);
    titleCell.append(titleTop);
    if (meta.childElementCount > 0) titleCell.append(meta);

    const priorityCell = el('span', 'task-row__priority');
    priorityCell.append(el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]));

    const statusCell = testId(el('button', 'story-col-state task-row__status'), 'task-status-button');
    statusCell.type = 'button';
    statusCell.title = 'Click to advance state';
    statusCell.append(el('span', `state-dot state-dot--${task.status}`), el('span', 'task-row__status-text', TASK_STATUS_LABELS[task.status]));
    statusCell.addEventListener('click', () => this.options.onCycleTaskStatus(task.id));

    const actions = el('div', 'task-row__actions');
    const editBtn = testId(el('button', 'button button-icon button-icon--edit'), 'edit-task-button');
    editBtn.type = 'button';
    editBtn.title = 'Edit task';
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', () => this.options.onEditTask(story.id, task.id));

    const deleteBtn = testId(el('button', 'button button-icon button-icon--delete'), 'delete-task-button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete task';
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', () => this.options.onDeleteTask(task.id));

    actions.append(editBtn, deleteBtn);
    row.append(expandCell, idCell, titleCell, priorityCell, statusCell, actions);
    return row;
  }
}
