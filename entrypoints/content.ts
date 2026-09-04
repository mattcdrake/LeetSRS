import type { Grade } from 'ts-fsrs';
import { getServiceTranslations } from '@/services/i18n';
import type { ProblemDescriptor } from '@/shared/cards';
import type { Translations } from '@/shared/i18n';
import { sendMessage } from '@/shared/messages';
import {
  createLeetSrsButton,
  type ExtractedProblemData,
  extractProblemData,
  getCurrentDomain,
  RatingMenu,
  setupLeetcodeAutoReset,
  Tooltip,
} from '@/utils/content';

export default defineContentScript({
  matches: ['*://*.leetcode.com/*', '*://*.leetcode.cn/*'],
  runAt: 'document_idle',
  async main() {
    // Wake up service worker so it's ready when user interacts
    try {
      await sendMessage('ping');
    } catch (error) {
      console.error('Failed to ping service worker:', error);
    }
    setupLeetSrsButton(await getServiceTranslations());
    setupLeetcodeAutoReset();
  },
});

function toProblemDescriptor(problemData: ExtractedProblemData): ProblemDescriptor {
  return {
    slug: problemData.titleSlug,
    name: problemData.title,
    leetcodeId: problemData.questionFrontendId,
    difficulty: problemData.difficulty,
    domain: getCurrentDomain(),
  };
}

async function withProblemData<T>(action: (problem: ProblemDescriptor) => Promise<T>): Promise<T | undefined> {
  const problemData = await extractProblemData();
  if (!problemData) {
    console.error('Could not extract problem data');
    return undefined;
  }

  try {
    return await action(toProblemDescriptor(problemData));
  } catch (error) {
    console.error('Error processing action:', error);
    return undefined;
  }
}

function setupLeetSrsButton(t: Translations) {
  const BUTTON_ID = 'leetsrs-button-wrapper';
  const tooltip = new Tooltip();

  function insertButton(buttonsContainer: Element) {
    if (buttonsContainer.querySelector(`#${BUTTON_ID}`)) {
      return;
    }

    let ratingMenu: RatingMenu | null = null;

    const buttonWrapper = createLeetSrsButton(() => {
      if (ratingMenu) {
        void ratingMenu.toggle();
      }
    }, t);
    buttonWrapper.id = BUTTON_ID;

    ratingMenu = new RatingMenu(
      buttonWrapper,
      async (rating, label) => {
        await withProblemData(async (problem) => {
          const result = await sendMessage('rateCard', {
            input: { ...problem, rating: rating as Grade },
          });
          console.log(`${label} - Card rated:`, result);
          return result;
        });
      },
      async () => {
        await withProblemData(async (problem) => {
          const result = await sendMessage('addCard', { problem });
          console.log('Add without rating - Card added:', result);
          return result;
        });
      },
      getServiceTranslations
    );

    const clickableDiv = buttonWrapper.querySelector('[data-state="closed"]') as HTMLElement;
    if (clickableDiv) {
      clickableDiv.addEventListener('mouseenter', () => {
        tooltip.show(clickableDiv, t.app.name);
      });

      clickableDiv.addEventListener('mouseleave', () => {
        tooltip.hide();
      });
    }

    const lastButtonGroup = buttonsContainer.lastElementChild;

    try {
      buttonsContainer.insertBefore(buttonWrapper, lastButtonGroup);
    } catch (error) {
      console.error('Error adding LeetSRS button:', error);
    }
  }

  const tryInsertButton = () => {
    const buttonsContainer = document.querySelector('#ide-top-btns');
    if (buttonsContainer) {
      insertButton(buttonsContainer);
    }
  };
  tryInsertButton();

  // Use MutationObserver to handle SPA navigation and React re-renders.
  const observer = new MutationObserver(tryInsertButton);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
