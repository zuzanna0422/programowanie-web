import type { Task } from '../models/Task';
import type { Story } from '../models/Story';
import type { User } from '../models/User';
import { el } from '../ui/dom';
import { fmtDate } from '../ui/format';
import { TASK_ICON_SVG } from '../ui/icons';
import { PRIORITY_LABELS, ROLE_LABELS, TASK_STATUS_LABELS } from '../ui/labels';

type TaskDetailViewOptions = {
  onBack: () => void;
  onAssignUser: (taskId: string, userId: string) => void;
  onClearAssignee: (task: Task) => void;
  onUpdateEstimatedHours: (task: Task, estimatedHours: number) => void;
  onUpdateActualHours: (task: Task, actualHours: number | null) => void;
  onCompleteTask: (taskId: string) => void;
};

type RenderTaskDetailOptions = {
  task: Task;
  story: Story | undefined;
  assignableUsers: User[];
};

export class TaskDetailView {
  readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private readonly backLabel: HTMLSpanElement;
  private readonly options: TaskDetailViewOptions;

  constructor(options: TaskDetailViewOptions) {
    this.options = options;
    this.element = el('div', 'view view-task-detail view--hidden');

    const backBtn = el('button', 'button button-back');
    backBtn.type = 'button';
    this.backLabel = el('span', undefined, '← Back');
    backBtn.append(this.backLabel);
    backBtn.addEventListener('click', this.options.onBack);

    this.content = el('div', 'task-detail-content');
    this.element.append(backBtn, this.content);
  }

  show(): void {
    this.backLabel.textContent = '← Back';
    this.element.classList.remove('view--hidden');
  }

  hide(): void {
    this.element.classList.add('view--hidden');
  }

  render({ task, story, assignableUsers }: RenderTaskDetailOptions): void {
    this.content.innerHTML = '';

    const headerBar = el('div', 'task-detail__header-bar');
    const uidBadge = el('span', 'task-detail__uid');
    uidBadge.innerHTML = `${TASK_ICON_SVG} #${task.uid}`;
    const priorityBadge = el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]);
    const statusBadge = el('span', `task-detail__status task-detail__status--${task.status}`, TASK_STATUS_LABELS[task.status]);
    headerBar.append(uidBadge, statusBadge, priorityBadge);

    const titleEl = el('h2', 'task-detail__title', task.name);
    const descEl = el('p', 'task-detail__desc', task.description);
    const details = el('div', 'task-detail__details');

    details.append(this.makeDetailRow('Story', story ? story.name : '—'));
    details.append(this.makeDetailRow('Created', fmtDate(task.createdAt)));
    details.append(this.makeDetailRow('Started', fmtDate(task.startedAt)));
    details.append(this.makeDetailRow('Completed', fmtDate(task.completedAt)));
    details.append(this.buildAssigneeRow(task, assignableUsers));
    details.append(this.buildEstimatedRow(task));
    details.append(this.buildActualRow(task));

    const actionsSection = el('div', 'task-detail__section task-detail__actions-section');
    if (task.status !== 'done') {
      const doneBtn = el('button', 'button button-done', '✓ Mark as Done');
      doneBtn.type = 'button';
      doneBtn.addEventListener('click', () => this.options.onCompleteTask(task.id));
      actionsSection.append(doneBtn);
    }

    this.content.append(headerBar, titleEl, descEl, details);
    if (actionsSection.childElementCount > 0) this.content.append(actionsSection);
  }

  private makeDetailRow(label: string, value: string): HTMLElement {
    const row = el('div', 'detail-row');
    row.append(el('span', 'detail-row__label', label), el('span', 'detail-row__value', value));
    return row;
  }

  private buildAssigneeRow(task: Task, assignableUsers: User[]): HTMLElement {
    const assigneeRow = el('div', 'detail-row');
    assigneeRow.append(el('span', 'detail-row__label', 'Assignee'));
    const assigneeValue = el('span', 'detail-row__value');
    const assignSelect = el('select', 'assign-select');
    const emptyOpt = el('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'Unassigned';
    assignSelect.append(emptyOpt);

    assignableUsers.forEach((u) => {
      const opt = el('option');
      opt.value = u.id;
      opt.textContent = `${u.firstName} ${u.lastName} (${ROLE_LABELS[u.role]})`;
      if (u.id === task.assigneeId) opt.selected = true;
      assignSelect.append(opt);
    });

    assignSelect.addEventListener('change', () => {
      if (assignSelect.value) {
        this.options.onAssignUser(task.id, assignSelect.value);
      } else {
        this.options.onClearAssignee(task);
      }
    });

    assigneeValue.append(assignSelect);
    assigneeRow.append(assigneeValue);
    return assigneeRow;
  }

  private buildEstimatedRow(task: Task): HTMLElement {
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
      this.options.onUpdateEstimatedHours(task, val);
    });
    estimatedValWrap.append(estimatedInput);
    estimatedRow.append(estimatedValWrap);
    return estimatedRow;
  }

  private buildActualRow(task: Task): HTMLElement {
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
      this.options.onUpdateActualHours(task, isNaN(val) ? null : val);
    });
    actualValWrap.append(actualInput);
    actualRow.append(actualValWrap);
    return actualRow;
  }
}
