import { expect, test } from '@playwright/test';
import { createProject, createStory, createTask, openAuthenticatedApp, openProject } from './fixtures/manageMe';

test.describe('Project, story and task creation', () => {
  test.beforeEach(async ({ page }) => {
    await openAuthenticatedApp(page);
  });

  test('creates a project, story and task from the UI', async ({ page }) => {
    await createProject(page, 'E2E Project', 'Project created by an end-to-end test');
    await openProject(page, 'E2E Project');
    await createStory(page, 'E2E Story', 'Story created by an end-to-end test');
    await createTask(page, 'E2E Story', 'E2E Task', 'Task created by an end-to-end test');

    await expect(page.getByTestId('story-group').filter({ hasText: 'E2E Story' })).toBeVisible();
    await expect(page.getByTestId('task-row').filter({ hasText: 'E2E Task' })).toBeVisible();
  });
});
