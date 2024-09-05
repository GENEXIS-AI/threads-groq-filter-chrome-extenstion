document.addEventListener('DOMContentLoaded', function() {
  const categories = ['기술', 'IT', '과학', '정치', '경제', '사회', '엔터테인먼트', '스포츠', '건강', '교육', '여행', '음식', '패션', '예술', '일상', '기타'];
  const blurIntensitySlider = document.getElementById('blur-intensity');
  const blurValueDisplay = document.getElementById('blur-value');
  const groqApiKeyInput = document.getElementById('groq-api-key');
  const apiKeySetup = document.getElementById('api-key-setup');
  const mainSettings = document.getElementById('main-settings');
  const filteringToggle = document.getElementById('filtering-toggle');
  const saveMessage = document.getElementById('save-message');

  // 설정 로드 및 UI 업데이트
  function loadSettings() {
    chrome.storage.sync.get(['groqApiKey', 'filteringEnabled', 'blurCategories', 'blurKeywords', 'blurIntensity'], function(result) {
      if (result.groqApiKey) {
        apiKeySetup.classList.add('hidden');
        mainSettings.classList.remove('hidden');
        
        filteringToggle.checked = result.filteringEnabled !== false; // 기본값은 true
        
        if (result.blurCategories) {
          categories.forEach(category => {
            const element = document.getElementById(`blur-${category.toLowerCase().replace(' ', '-')}`);
            if (element) {
              element.checked = result.blurCategories.includes(category);
            }
          });
        }
        
        if (result.blurKeywords) {
          document.getElementById('blur-keywords').value = result.blurKeywords.join(', ');
        }
        
        if (result.blurIntensity) {
          blurIntensitySlider.value = result.blurIntensity;
          blurValueDisplay.textContent = `${result.blurIntensity}px`;
        }
      } else {
        apiKeySetup.classList.remove('hidden');
        mainSettings.classList.add('hidden');
      }
    });
  }

  // 초기 설정 로드
  loadSettings();

  // API 키 저장 버튼 이벤트
  document.getElementById('save-api-key').addEventListener('click', function() {
    const apiKey = groqApiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ groqApiKey: apiKey }, function() {
        showSaveMessage('API 키가 저장되었습니다.');
        loadSettings();
      });
    } else {
      alert('유효한 API 키를 입력해주세요.');
    }
  });

  // 블러 강도 슬라이더 이벤트
  blurIntensitySlider.addEventListener('input', function() {
    blurValueDisplay.textContent = `${this.value}px`;
  });

  // 설정 저장 버튼 클릭 이벤트
  document.getElementById('save-settings').addEventListener('click', function() {
    saveSettings();
  });

  // 필터링 토글 이벤트
  filteringToggle.addEventListener('change', function() {
    saveSettings();
  });

  function saveSettings() {
    const blurCategories = categories.filter(category => {
      const element = document.getElementById(`blur-${category.toLowerCase().replace(' ', '-')}`);
      return element && element.checked;
    });

    const blurKeywords = document.getElementById('blur-keywords').value
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword !== '');

    const blurIntensity = parseInt(blurIntensitySlider.value);
    const filteringEnabled = filteringToggle.checked;

    chrome.storage.sync.set({ blurCategories, blurKeywords, blurIntensity, filteringEnabled }, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "settingsUpdated",
          filteringEnabled: filteringEnabled,
          blurIntensity: blurIntensity,
          blurCategories: blurCategories,
          blurKeywords: blurKeywords
        });
      });
      showSaveMessage('설정이 저장되었습니다.');
    });
  }

  function showSaveMessage(message) {
    saveMessage.textContent = message;
    saveMessage.style.opacity = '1';
    setTimeout(() => {
      saveMessage.style.opacity = '0';
    }, 3000);
  }
});