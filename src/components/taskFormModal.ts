import type { Task, TaskPriority } from '../models/Task';
import type { Story } from '../models/Story';
import { el, testId } from '../ui/dom';
import { PRIORITY_LABELS } from '../ui/labels';

export type TaskFormPayload = {
  editedTaskId: string | null;
  storyId: string;
  name: string;
  description: string;
  priority: TaskPriority;
  estimatedHours: number;
};

type TaskFormModalOptions = {
  createField: (labelText: string, input: HTMLElement) => HTMLElement;
  onSubmit: (payload: TaskFormPayload) => void;
};

export class TaskFormModal {
  readonly element: HTMLElement;
  private readonly createField: (labelText: string, input: HTMLElement) => HTMLElement;
  private readonly onSubmit: (payload: TaskFormPayload) => void;
  private currentEditTaskId: string | null = null;
  private title: HTMLElement;
  private storySelect: HTMLSelectElement;
  private nameInput: HTMLInputElement;
  private descInput: HTMLTextAreaElement;
  private prioritySelect: HTMLSelectElement;
  private estHoursInput: HTMLInputElement;
  private submitBtn: HTMLButtonElement;

  constructor(options: TaskFormModalOptions) {
    this.createField = options.createField;
    this.onSubmit = options.onSubmit;
    this.element = el('div', 'modal-overlay modal-overlay--hidden');

    const dialog = el('div', 'modal-dialog');
    const modalHeader = el('div', 'modal-header');
    this.title = el('h3', 'modal-title', 'Add Task');
    const closeBtn = el('button', 'modal-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.close());
    modalHeader.append(this.title, closeBtn);

    const form = el('form', 'form-card modal-form');

    this.storySelect = testId(el('select'), 'task-story-select');
    this.storySelect.required = true;

    this.nameInput = testId(el('input'), 'task-name-input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Task name';
    this.nameInput.required = true;

    this.descInput = testId(el('textarea'), 'task-description-input');
    this.descInput.placeholder = 'Task description';
    this.descInput.rows = 3;
    this.descInput.required = true;

    this.prioritySelect = testId(el('select'), 'task-priority-select');
    (['low', 'medium', 'high'] as TaskPriority[]).forEach((p) => {
      const opt = el('option');
      opt.value = p;
      opt.textContent = PRIORITY_LABELS[p];
      this.prioritySelect.append(opt);
    });

    this.estHoursInput = testId(el('input'), 'task-estimated-hours-input');
    this.estHoursInput.type = 'number';
    this.estHoursInput.min = '0.5';
    this.estHoursInput.step = '0.5';
    this.estHoursInput.placeholder = 'e.g. 4';
    this.estHoursInput.required = true;

    const row = el('div', 'form-card__row');
    row.append(
      this.createField('Priority', this.prioritySelect),
      this.createField('Estimated hours', this.estHoursInput),
    );

    this.submitBtn = testId(el('button', 'button button-primary', 'Save'), 'task-submit-button');
    this.submitBtn.type = 'submit';
    const cancelBtn = el('button', 'button button-cancel', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => this.close());
    const actions = el('div', 'form-actions');
    actions.append(this.submitBtn, cancelBtn);

    form.append(
      this.createField('Story', this.storySelect),
      this.createField('Name', this.nameInput),
      this.createField('Description', this.descInput),
      row,
      actions,
    );
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    dialog.append(modalHeader, form);
    this.element.append(dialog);

    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) this.close();
    });
  }

  open(stories: Story[], contextStoryId?: string, task?: Task): void {
    this.storySelect.innerHTML = '';
    stories.forEach((s) => {
      const opt = el('option');
      opt.value = s.id;
      opt.textContent = `#${s.uid} ${s.name}`;
      this.storySelect.append(opt);
    });

    this.currentEditTaskId = task?.id ?? null;

    if (task) {
      this.title.textContent = 'Edit Task';
      this.storySelect.value = task.storyId;
      this.nameInput.value = task.name;
      this.descInput.value = task.description;
      this.prioritySelect.value = task.priority;
      this.estHoursInput.value = String(task.estimatedHours);
      this.submitBtn.textContent = 'Update';
    } else {
      this.title.textContent = 'Add Task';
      this.nameInput.value = '';
      this.descInput.value = '';
      this.prioritySelect.value = 'medium';
      this.estHoursInput.value = '';
      this.submitBtn.textContent = 'Save';
      if (contextStoryId) this.storySelect.value = contextStoryId;
    }

    this.element.classList.remove('modal-overlay--hidden');
  }

  close(): void {
    this.element.classList.add('modal-overlay--hidden');
    this.currentEditTaskId = null;
  }

  private handleSubmit(e: Event): void {
    e.preventDefault();
    const storyId = this.storySelect.value;
    const name = this.nameInput.value.trim();
    const description = this.descInput.value.trim();
    const priority = this.prioritySelect.value as TaskPriority;
    const estimatedHours = parseFloat(this.estHoursInput.value);
    if (!storyId || !name || !description || isNaN(estimatedHours)) return;

    this.onSubmit({
      editedTaskId: this.currentEditTaskId,
      storyId,
      name,
      description,
      priority,
      estimatedHours,
    });
  }
}
