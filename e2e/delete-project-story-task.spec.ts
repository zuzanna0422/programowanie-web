import { expect, test } from '@playwright/test';
import { createProjectStoryAndTask, dismissNotifications, openAuthenticatedApp } from './fixtures/manageMe';

test.describe('Project, story and task deletion', () => {
  test.beforeEach(async ({ page }) => {
    await openAuthenticatedApp(page);
  });

  test('deletes a task, story and project from the UI', async ({ page }) => {
    await createProjectStoryAndTask(page);

    const story = page.getByTestId('story-group').filter({ hasText: 'E2E Story' });
    const task = story.getByTestId('task-row').filter({ hasText: 'E2E Task' });
    await dismissNotifications(page);

    page.once('dialog', (dialog) => dialog.accept());
    await task.getByTestId('delete-task-button').click();
    await expect(story.getByTestId('task-row').filter({ hasText: 'E2E Task' })).toHaveCount(0);
    await dismissNotifications(page);

    page.once('dialog', (dialog) => dialog.accept());
    await story.getByTestId('delete-story-button').click();
    await expect(page.getByTestId('story-group').filter({ hasText: 'E2E Story' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to Projects' }).click();
    const project = page.getByTestId('project-card').filter({ hasText: 'E2E Project' });
    page.once('dialog', (dialog) => dialog.accept());
    await project.getByTestId('delete-project-button').click();
    await expect(page.getByTestId('project-card').filter({ hasText: 'E2E Project' })).toHaveCount(0);
    await expect(page.getByText('No projects yet. Add your first project.')).toBeVisible();
  });
});
