console.log('Content script loaded');

let blurCategories = [];
let blurKeywords = [];
let blurIntensity = 5;
let filteringEnabled = true;

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['blurCategories', 'blurKeywords', 'blurIntensity', 'filteringEnabled'], function(result) {
      blurCategories = result.blurCategories || [];
      blurKeywords = result.blurKeywords || [];
      blurIntensity = result.blurIntensity || 5;
      filteringEnabled = result.filteringEnabled !== false; // 기본값은 true
      resolve();
    });
  });
}

function shouldBlurContent(category, text) {
  const lowerCategory = category.toLowerCase().trim();
  if (blurCategories.some(c => lowerCategory.includes(c.toLowerCase().trim()))) {
    return true;
  }
  if (blurKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
    return true;
  }
  return false;
}

function selectFeedElements() {
  return document.querySelectorAll('div[data-pressable-container="true"]');
}

function extractText(element) {
  const textContents = element.querySelectorAll('.x1a6qonq.x6ikm8r.x10wlt62.xj0a0fe.x126k92a.x6prxxf.x7r5mf7');
  if (textContents.length > 0) {
    return Array.from(textContents).map(span => span.textContent.trim()).join(' ');
  }
  return '';
}

async function classifyContent(text) {
  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'classifyContent',
        text: text
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.classification);
        }
      });
    });
  } catch (error) {
    return JSON.stringify({ categories: ['기타'], appropriate: true });
  }
}

async function processFeed() {
  if (!filteringEnabled) return; // 필터링이 비활성화되어 있으면 처리하지 않음

  const feedElements = Array.from(selectFeedElements());
  const batchSize = 5;
  
  for (let i = 0; i < feedElements.length; i += batchSize) {
    const batch = feedElements.slice(i, i + batchSize);
    await Promise.all(batch.map(processElement));
  }
}

async function processElement(element) {
  if (element.dataset.processed) return;
  element.dataset.processed = 'true';

  const text = extractText(element);
  if (text) {
    try {
      const classificationResult = await classifyContent(text);
      const { categories, appropriate } = JSON.parse(classificationResult);
      const shouldBlur = categories.some(category => shouldBlurContent(category, text));
      
      element.style.display = 'block';

      if (!appropriate || shouldBlur) {
        applyBlur(element, categories);
      } else {
        removeBlur(element);
        addCategoryLabel(element, categories);
      }
    } catch (error) {
      element.style.display = 'block';
    }
  }
}

function addCategoryLabel(element, categories) {
  let label = element.querySelector('.category-label');
  if (!label) {
    label = document.createElement('div');
    label.className = 'category-label';
    label.style.position = 'absolute';
    label.style.top = '10px';
    label.style.right = '10px';
    label.style.padding = '5px 10px';
    label.style.borderRadius = '5px';
    label.style.fontSize = '12px';
    label.style.fontWeight = 'bold';
    label.style.zIndex = '3';
    label.style.display = 'flex';
    label.style.flexWrap = 'wrap';
    label.style.maxWidth = '80%';
    element.appendChild(label);
  } else {
    label.innerHTML = '';
  }

  categories.forEach(category => {
    const categorySpan = document.createElement('span');
    categorySpan.textContent = category;
    categorySpan.style.backgroundColor = getCategoryColor(category);
    categorySpan.style.color = 'white';
    categorySpan.style.padding = '2px 5px';
    categorySpan.style.margin = '2px';
    categorySpan.style.borderRadius = '3px';
    label.appendChild(categorySpan);
  });
}

function getCategoryColor(category) {
  const colors = {
    '기술': '#007bff',
    'IT': '#0056b3',
    '과학': '#17a2b8',
    '정치': '#dc3545',
    '경제': '#28a745',
    '사회': '#6c757d',
    '엔터테인먼트': '#e83e8c',
    '스포츠': '#ffc107',
    '건강': '#20c997',
    '교육': '#6610f2',
    '여행': '#fd7e14',
    '음식': '#d63384',
    '패션': '#6f42c1',
    '예술': '#f8f9fa',
    '일상': '#343a40',
    '기타': '#6c757d'
  };
  return colors[category] || '#6c757d';
}

function applyBlur(element, categories) {
  element.style.position = 'relative';
  
  let contentContainer = element.querySelector('.content-container');
  if (!contentContainer) {
    contentContainer = document.createElement('div');
    contentContainer.className = 'content-container';
    contentContainer.style.filter = `blur(${blurIntensity}px)`;
    contentContainer.style.transition = 'filter 0.3s';
    
    while (element.firstChild) {
      contentContainer.appendChild(element.firstChild);
    }
    element.appendChild(contentContainer);
  } else {
    contentContainer.style.filter = `blur(${blurIntensity}px)`;
  }

  let warning = element.querySelector('.warning-message');
  if (!warning) {
    warning = document.createElement('div');
    warning.className = 'warning-message';
    warning.textContent = '부적절한 콘텐츠일 수 있습니다. 클릭하여 표시';
    warning.style.position = 'absolute';
    warning.style.top = '50%';
    warning.style.left = '50%';
    warning.style.transform = 'translate(-50%, -50%)';
    warning.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    warning.style.color = 'white';
    warning.style.padding = '10px';
    warning.style.borderRadius = '5px';
    warning.style.cursor = 'pointer';
    warning.style.zIndex = '2';
    warning.style.textAlign = 'center';
    warning.style.maxWidth = '80%';
    warning.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.3)';
    warning.onclick = () => removeBlur(element);
    element.appendChild(warning);
  }

  addCategoryLabel(element, categories);
}

function removeBlur(element) {
  const contentContainer = element.querySelector('.content-container');
  if (contentContainer) {
    contentContainer.style.filter = 'none';
  }
  const warning = element.querySelector('.warning-message');
  if (warning) {
    warning.remove();
  }
}

function setupMutationObserver() {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = function(mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches('div[data-pressable-container="true"]')) {
            if (!node.dataset.processed) {
              processNewFeedItem(node);
            }
          }
        });
      }
    }
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

async function processNewFeedItem(element) {
  const text = extractText(element);
  if (text) {
    try {
      const classificationResult = await classifyContent(text);
      const { categories, appropriate } = JSON.parse(classificationResult);
      element.style.display = 'block';
      addCategoryLabel(element, categories);

      if (!appropriate || categories.some(category => shouldBlurContent(category, text))) {
        applyBlur(element, categories);
      } else {
        removeBlur(element);
      }
    } catch (error) {
      element.style.display = 'block';
    }
  }
}

async function init() {
  await loadSettings();
  setupMutationObserver();
  processFeed();
}

window.addEventListener('load', init);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "settingsUpdated") {
    filteringEnabled = request.filteringEnabled;
    blurIntensity = request.blurIntensity;
    blurCategories = request.blurCategories;
    blurKeywords = request.blurKeywords;
    
    if (filteringEnabled) {
      processFeed();
    } else {
      removeAllBlur();
    }
  }
});

function removeAllBlur() {
  const feedElements = selectFeedElements();
  feedElements.forEach(element => {
    removeBlur(element);
    const categoryLabel = element.querySelector('.category-label');
    if (categoryLabel) {
      categoryLabel.remove();
    }
  });
}

setInterval(() => {
  processFeed();
}, 300);