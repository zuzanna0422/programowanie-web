import { Project } from '../api/projectStorage';
import { el, testId } from '../ui/dom';
import trashSvg from '../assets/icons/trash.svg?raw';
import editSvg from '../assets/icons/edit.svg?raw';

export type ProjectFormPayload = {
  editProjectId: string | null;
  name: string;
  description: string;
};

type ProjectsSectionOptions = {
  createField: (labelText: string, input: HTMLElement) => HTMLElement;
  onSubmitProject: (payload: ProjectFormPayload) => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
};

export class ProjectsSection {
  readonly element: HTMLElement;

  private currentEditProjectId: string | null = null;
  private formWrapper: HTMLElement;
  private form: HTMLFormElement;
  private nameInput: HTMLInputElement;
  private descInput: HTMLTextAreaElement;
  private submitBtn: HTMLButtonElement;
  private listContainer: HTMLElement;

  constructor(private options: ProjectsSectionOptions) {
    this.element = el('section', 'projects-section');

    const titleBar = el('div', 'section-title-bar');
    const h2 = el('h2', undefined, 'Projects');
    const addBtn = testId(el('button', 'button button-primary', '+ Add project'), 'add-project-button');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => this.toggleForm());
    titleBar.append(h2, addBtn);

    this.formWrapper = el('div', 'form-wrapper form-wrapper--hidden');
    this.form = testId(el('form', 'form-card'), 'project-form');
    this.nameInput = testId(el('input'), 'project-name-input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Project name';
    this.nameInput.required = true;
    this.descInput = testId(el('textarea'), 'project-description-input');
    this.descInput.placeholder = 'Project description';
    this.descInput.rows = 3;
    this.descInput.required = true;
    this.submitBtn = testId(el('button', 'button button-primary', 'Save'), 'project-submit-button');
    this.submitBtn.type = 'submit';
    const cancelBtn = el('button', 'button button-cancel', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => this.cancelForm());

    const formActions = el('div', 'form-actions');
    formActions.append(this.submitBtn, cancelBtn);
    this.form.append(
      this.options.createField('Name', this.nameInput),
      this.options.createField('Description', this.descInput),
      formActions,
    );
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.formWrapper.append(this.form);

    this.listContainer = el('div');
    this.element.append(titleBar, this.formWrapper, this.listContainer);
  }

  render(projects: Project[], activeProjectId: string | null): void {
    this.listContainer.innerHTML = '';

    if (projects.length === 0) {
      if (!this.isFormOpen()) {
        this.listContainer.append(el('p', 'empty-state', 'No projects yet. Add your first project.'));
      }
      return;
    }

    const list = el('div', 'projects-list');
    projects
      .filter((project) => project.id !== this.currentEditProjectId)
      .forEach((project) => this.buildProjectCard(project, activeProjectId, list));
    this.listContainer.append(list);
  }

  closeForm(): void {
    this.formWrapper.classList.add('form-wrapper--hidden');
    this.form.reset();
    this.currentEditProjectId = null;
    this.submitBtn.textContent = 'Save';
  }

  clearEditingIfProject(projectId: string): void {
    if (this.currentEditProjectId === projectId) this.closeForm();
  }

  private toggleForm(forceOpen = false): void {
    if (!this.isFormOpen() || forceOpen) {
      this.formWrapper.classList.remove('form-wrapper--hidden');
    } else {
      this.closeForm();
    }
  }

  private cancelForm(): void {
    this.closeForm();
  }

  private handleSubmit(e: Event): void {
    e.preventDefault();
    const name = this.nameInput.value.trim();
    const description = this.descInput.value.trim();
    if (!name || !description) return;

    this.options.onSubmitProject({
      editProjectId: this.currentEditProjectId,
      name,
      description,
    });
  }

  private loadProjectForEdit(project: Project): void {
    this.currentEditProjectId = project.id;
    this.nameInput.value = project.name;
    this.descInput.value = project.description;
    this.submitBtn.textContent = 'Update';
    this.toggleForm(true);
    this.formWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  private buildProjectCard(project: Project, activeProjectId: string | null, container: HTMLElement): void {
    const isActive = project.id === activeProjectId;
    const card = testId(el('article', `project-card${isActive ? ' project-card--active' : ''}`), 'project-card');
    card.addEventListener('click', () => this.options.onOpenProject(project.id));

    const content = el('div', 'project-card__content');
    const titleRow = el('div', 'project-card__top');
    const title = el('h3', 'project-card__title', project.name);
    titleRow.append(title);
    if (isActive) titleRow.append(el('span', 'active-badge', 'Active'));
    const desc = el('p', 'project-card__desc', project.description);
    content.append(titleRow, desc);

    const actions = el('div', 'project-actions');

    const editBtn = testId(el('button', 'button button-icon button-icon--edit'), 'edit-project-button');
    editBtn.type = 'button';
    editBtn.title = 'Edit project';
    editBtn.setAttribute('aria-label', 'Edit project');
    editBtn.innerHTML = editSvg;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.loadProjectForEdit(project);
    });

    const deleteBtn = testId(el('button', 'button button-icon button-icon--delete'), 'delete-project-button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Delete project';
    deleteBtn.setAttribute('aria-label', 'Delete project');
    deleteBtn.innerHTML = trashSvg;
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onDeleteProject(project.id);
    });

    actions.append(editBtn, deleteBtn);
    card.append(content, actions);
    container.append(card);
  }

  private isFormOpen(): boolean {
    return !this.formWrapper.classList.contains('form-wrapper--hidden');
  }
}
