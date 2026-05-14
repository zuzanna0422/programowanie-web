import { expect, type Locator, type Page } from '@playwright/test';

const adminUser = {
  id: 'e2e-admin',
  firstName: 'E2E',
  lastName: 'Admin',
  email: 'e2e.admin@example.com',
  role: 'admin',
  isBlocked: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export async function openAuthenticatedApp(page: Page) {
  await page.addInitScript((user) => {
    localStorage.clear();
    localStorage.setItem('manageMe:users', JSON.stringify([user]));
    localStorage.setItem('manageMe:session', JSON.stringify({ userId: user.id }));
  }, adminUser);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ManageMe' })).toBeVisible();
}

export async function dismissNotifications(page: Page) {
  const dialog = page.locator('.notif-dialog-container:not(.notif-dialog--hidden)');
  const dismiss = page.getByRole('button', { name: 'Dismiss' });

  for (let i = 0; i < 5; i += 1) {
    await dialog.waitFor({ state: 'visible', timeout: 500 }).catch(() => undefined);
    const visible = await dialog.isVisible().catch(() => false);
    if (!visible) return;
    await dismiss.click();
    await expect(dialog).toBeHidden();
  }
}

export async function createProject(page: Page, name: string, description: string) {
  await page.getByTestId('add-project-button').click();
  await page.getByTestId('project-name-input').fill(name);
  await page.getByTestId('project-description-input').fill(description);
  await page.getByTestId('project-submit-button').click();
  await expect(page.getByTestId('project-card').filter({ hasText: name })).toBeVisible();
  await dismissNotifications(page);
}

export async function openProject(page: Page, name: string) {
  await page.getByTestId('project-card').filter({ hasText: name }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

export async function createStory(page: Page, title: string, description: string) {
  await page.getByTestId('add-story-button').click();
  await page.getByTestId('story-title-input').fill(title);
  await page.getByTestId('story-description-input').fill(description);
  await page.getByTestId('story-priority-select').selectOption('high');
  await page.getByTestId('story-submit-button').click();
  await expect(page.getByTestId('story-group').filter({ hasText: title })).toBeVisible();
}

export async function expandStory(page: Page, title: string) {
  const story = page.getByTestId('story-group').filter({ hasText: title });
  await story.getByTestId('story-expand-button').click();
  return story;
}

export async function createTask(page: Page, storyTitle: string, taskName: string, description: string) {
  const story = await expandStory(page, storyTitle);
  await story.getByTestId('add-task-button').click();
  await page.getByTestId('task-name-input').fill(taskName);
  await page.getByTestId('task-description-input').fill(description);
  await page.getByTestId('task-priority-select').selectOption('medium');
  await page.getByTestId('task-estimated-hours-input').fill('4');
  await page.getByTestId('task-submit-button').click();
  await expect(story.getByTestId('task-row').filter({ hasText: taskName })).toBeVisible();
  await dismissNotifications(page);
}

export async function createProjectStoryAndTask(page: Page): Promise<{ story: Locator; task: Locator }> {
  await createProject(page, 'E2E Project', 'Project created by an end-to-end test');
  await openProject(page, 'E2E Project');
  await createStory(page, 'E2E Story', 'Story created by an end-to-end test');
  await createTask(page, 'E2E Story', 'E2E Task', 'Task created by an end-to-end test');

  const story = page.getByTestId('story-group').filter({ hasText: 'E2E Story' });
  const task = story.getByTestId('task-row').filter({ hasText: 'E2E Task' });

  return { story, task };
}
