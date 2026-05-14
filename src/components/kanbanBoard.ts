import type { Story } from '../models/Story';
import type { Task, TaskStatus } from '../models/Task';
import type { User } from '../models/User';
import { el } from '../ui/dom';
import { TASK_ICON_SVG } from '../ui/icons';
import { PRIORITY_LABELS } from '../ui/labels';

type KanbanBoardOptions = {
  stories: Story[];
  tasks: Task[];
  getUserById: (id: string) => User | undefined;
  onTaskClick: (taskId: string) => void;
};

const STATUSES: TaskStatus[] = ['todo', 'doing', 'done'];
const COLUMN_TITLES: Record<TaskStatus, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
};

export const buildKanbanBoard = ({ stories, tasks, getUserById, onTaskClick }: KanbanBoardOptions): HTMLElement => {
  const board = el('div', 'kanban-board');

  STATUSES.forEach((status) => {
    const statusTasks = tasks.filter((task) => task.status === status);
    const col = el('div', 'kanban-col');

    const colHeader = el('div', 'kanban-col__header');
    const colDot = el('span', `state-dot state-dot--${status}`);
    const colTitle = el('span', 'kanban-col__title', COLUMN_TITLES[status]);
    const colCount = el('span', 'kanban-col__count', String(statusTasks.length));
    colHeader.append(colDot, colTitle, colCount);
    col.append(colHeader);

    const cardList = el('div', 'kanban-cards');
    if (statusTasks.length === 0) {
      cardList.append(el('p', 'empty-state empty-state--sm', 'No tasks'));
    } else {
      statusTasks.forEach((task) => {
        const story = stories.find((s) => s.id === task.storyId);
        cardList.append(buildKanbanCard(task, story, getUserById, onTaskClick));
      });
    }
    col.append(cardList);
    board.append(col);
  });

  return board;
};

const buildKanbanCard = (
  task: Task,
  story: Story | undefined,
  getUserById: (id: string) => User | undefined,
  onTaskClick: (taskId: string) => void,
): HTMLElement => {
  const card = el('div', `kanban-card kanban-card--${task.status}`);
  card.addEventListener('click', () => onTaskClick(task.id));

  const cardTop = el('div', 'kanban-card__top');
  const taskIconEl = el('span', 'kanban-card__icon');
  taskIconEl.innerHTML = TASK_ICON_SVG;
  const uidEl = el('span', 'kanban-card__uid', `#${task.uid}`);
  cardTop.append(taskIconEl, uidEl);

  const name = el('p', 'kanban-card__name', task.name);
  const storyLabel = el('span', 'kanban-card__story', story ? story.name : '—');
  const cardBottom = el('div', 'kanban-card__bottom');
  cardBottom.append(el('span', `priority-badge priority-badge--${task.priority}`, PRIORITY_LABELS[task.priority]));

  if (task.assigneeId) {
    const assignee = getUserById(task.assigneeId);
    if (assignee) {
      const av = el('span', 'user-avatar user-avatar--xs', `${assignee.firstName[0]}${assignee.lastName[0]}`);
      cardBottom.append(av);
    }
  }

  card.append(cardTop, name, storyLabel, cardBottom);
  return card;
};
