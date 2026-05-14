import { expect, test } from '@playwright/test';
import { createProjectStoryAndTask, dismissNotifications, openAuthenticatedApp } from './fixtures/manageMe';

test.describe('Project, story and task editing', () => {
  test.beforeEach(async ({ page }) => {
    await openAuthenticatedApp(page);
  });

  test('edits task, story and project details', async ({ page }) => {
    const { story, task } = await createProjectStoryAndTask(page);

    await task.getByTestId('edit-task-button').click();
    await page.getByTestId('task-name-input').fill('E2E Task updated');
    await page.getByTestId('task-description-input').fill('Updated task description');
    await page.getByTestId('task-estimated-hours-input').fill('6');
    await page.getByTestId('task-submit-button').click();
    await expect(story.getByTestId('task-row').filter({ hasText: 'E2E Task updated' })).toBeVisible();
    await dismissNotifications(page);

    await story.getByTestId('edit-story-button').click();
    await page.getByTestId('story-title-input').fill('E2E Story updated');
    await page.getByTestId('story-description-input').fill('Updated story description');
    await page.getByTestId('story-status-select').selectOption('doing');
    await page.getByTestId('story-submit-button').click();
    await expect(page.getByTestId('story-group').filter({ hasText: 'E2E Story updated' })).toBeVisible();

    await page.getByRole('button', { name: 'Back to Projects' }).click();
    const project = page.getByTestId('project-card').filter({ hasText: 'E2E Project' });
    await project.getByTestId('edit-project-button').click();
    await page.getByTestId('project-name-input').fill('E2E Project updated');
    await page.getByTestId('project-description-input').fill('Updated project description');
    await page.getByTestId('project-submit-button').click();
    await expect(page.getByTestId('project-card').filter({ hasText: 'E2E Project updated' })).toBeVisible();
  });
});
