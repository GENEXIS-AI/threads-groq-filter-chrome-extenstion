console.log('백그라운드 스크립트가 로드되었습니다.');

chrome.runtime.onInstalled.addListener(() => {
  console.log('확장 프로그램이 설치되었습니다.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'classifyContent') {
    console.log('백그라운드: 분류 요청 받음', request.text.substring(0, 100) + '...');
    classifyContent(request.text)
      .then(classification => {
        console.log('백그라운드: 분류 완료', classification);
        sendResponse({ classification });
      })
      .catch(error => {
        console.error('백그라운드: 분류 오류', error);
        sendResponse({ error: error.message });
      });
    return true; // 비동기 응답을 위해 true 반환
  }
});

async function classifyContent(text) {
  console.log('Groq API 호출 시작 (백그라운드)');
  try {
    const { groqApiKey } = await chrome.storage.sync.get('groqApiKey');
    if (!groqApiKey) {
      throw new Error('Groq API 키가 설정되지 않았습니다.');
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: '피드 내용을 분석하고 다음 JSON 형식으로 응답해주세요: {"categories": ["카테고리1", "카테고리2", ...], "appropriate": true|false}. "categories"는 콘텐츠에 해당하는 모든 카테고리를 포함해야 합니다. "appropriate"는 콘텐츠가 적절한지 여부를 나타냅니다. 폭력적, 성적, 혐오 표현이 포함된 경우 false로 설정하세요. 일상적인 내용, 개인의 일상 이야기, 잡담 등은 "일상" 카테고리로 분류하세요.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: {
          type: 'json_object'
         },
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: 50,
        top_p: 1,
        stream: false,
        stop: null
      })
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('API 요청 제한 도달. 잠시 후 다시 시도합니다.');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5초 대기
        return classifyContent(text); // 재귀적으로 다시 시도
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('Groq API 응답 (백그라운드):', result);

    if (!result.choices || result.choices.length === 0) {
      throw new Error('API 응답에 유효한 선택이 없습니다.');
    }

    return result.choices[0].message.content;
  } catch (error) {
    console.error('Groq API 호출 중 오류 발생:', error);
    return JSON.stringify({ categories: ['기타'], appropriate: true }); // 기본값 반환
  }
}