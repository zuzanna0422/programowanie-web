import { expect, test } from '@playwright/test';
import { createProjectStoryAndTask, dismissNotifications, openAuthenticatedApp } from './fixtures/manageMe';

test.describe('Task status update', () => {
  test.beforeEach(async ({ page }) => {
    await openAuthenticatedApp(page);
  });

  test('moves a task from To Do to Doing', async ({ page }) => {
    const { story, task } = await createProjectStoryAndTask(page);

    await task.getByTestId('task-status-button').click();
    await expect(story.getByTestId('task-row').filter({ hasText: 'E2E Task' }).getByTestId('task-status-button')).toContainText('Doing');
    await dismissNotifications(page);
  });
});
