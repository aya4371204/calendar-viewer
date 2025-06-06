// calendar_viewer_web.js (主要部分の抜粋と概念)

// ★★★ GCPで作成したウェブアプリケーション用の情報を設定 ★★★
const API_KEY = 'AIzaSyCpRjx_lkdpcp-eePb-_psrh5MUB-T06aA';
const CLIENT_ID = '976002357617-j8i08ahpphr1frt1ko7tltvfbp847alk.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// DOM Elements (full_view.jsと同様)
// ... (getElementByIdなど) ...
const signInButton = document.getElementById('signInButton');
const signOutButton = document.getElementById('signOutButton');


// --- Resource Data (full_view.jsと同様) ---
const resourceCalendarItems = [ /* ... full_view.js と同じ会議室リスト ... */ ];
let currentView = 'dailyMatrix';
let selectedDate = new Date();
// ... (その他の状態変数も同様) ...


// --- GAPI と GIS の初期化 ---
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    });
    gapiInited = true;
    maybeEnableAuthButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // トークン取得後の処理を空にするか、アクセストークンを直接処理する
    });
    gisInited = true;
    maybeEnableAuthButtons();
}

function maybeEnableAuthButtons() {
    if (gapiInited && gisInited) {
        signInButton.style.display = 'block';
        // 必要に応じて、既にサインイン済みかどうかのチェック処理を追加
    }
}

// --- 認証処理 ---
signInButton.onclick = () => {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        signOutButton.style.display = 'block';
        signInButton.style.display = 'none';
        // アクセストークンをgapiクライアントに設定
        gapi.client.setToken({ access_token: resp.access_token });
        fetchData(); // サインイン後にデータを取得
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
};

signOutButton.onclick = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            dataDisplayArea.innerHTML = ''; // 表示をクリア
            signInButton.style.display = 'block';
            signOutButton.style.display = 'none';
            showError('サインアウトしました。');
        });
    }
};


// --- データ取得処理 (fetchData) ---
async function fetchData() {
    if (!gapi.client.getToken()) {
        showError("Googleアカウントでサインインしてください。");
        return;
    }
    showLoading(true);
    showError('');
    dataDisplayArea.innerHTML = '';

    let timeMinISO, timeMaxISO;
    let idsToFetchDetails = []; // API呼び出し対象のIDリスト

    if (currentView === 'dailyMatrix') {
        timeMinISO = new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString();
        timeMaxISO = new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString();
        idsToFetchDetails = resourceCalendarItems.map(item => item.id);
    } else { // weeklyRoom
        // ... (weeklyRoomのロジックも同様にidsToFetchDetailsを設定) ...
        if (!currentSelectedRoomId) { showError("会議室が選択されていません。"); showLoading(false); return; }
        const weekEnd = new Date(currentWeekStartDate); weekEnd.setDate(currentWeekStartDate.getDate() + 6);
        timeMinISO = new Date(new Date(currentWeekStartDate).setHours(0, 0, 0, 0)).toISOString();
        timeMaxISO = new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString();
        idsToFetchDetails = [currentSelectedRoomId];
    }
    
    if (idsToFetchDetails.length === 0) {
        showError("取得対象のリソースがありません。");
        showLoading(false);
        return;
    }

    const allCalendarData = {};
    try {
        const requests = idsToFetchDetails.map(calendarId => {
            return gapi.client.calendar.events.list({
                'calendarId': calendarId,
                'timeMin': timeMinISO,
                'timeMax': timeMaxISO,
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 50, // 必要に応じて調整
                'orderBy': 'startTime'
            });
        });

        const responses = await Promise.allSettled(requests);
        
        responses.forEach((response, index) => {
            const calendarId = idsToFetchDetails[index];
            if (response.status === 'fulfilled' && response.value.result) {
                allCalendarData[calendarId] = {
                    items: response.value.result.items.map(event => ({
                        id: event.id,
                        summary: event.summary || '(タイトルなし)',
                        start: event.start,
                        end: event.end,
                        organizer: event.organizer ? (event.organizer.displayName || event.organizer.email) : '(主催者不明)',
                        attendees: event.attendees ? event.attendees.map(att => att.displayName || att.email) : []
                    }))
                };
            } else {
                console.error(`Error fetching events for ${calendarId}:`, response.reason || response.value);
                allCalendarData[calendarId] = { items: [], errorDetails: response.reason || response.value };
            }
        });

        showLoading(false);
        if (currentView === 'dailyMatrix') {
            renderDailyMatrixView(allCalendarData);
        } else {
            renderWeeklyRoomView(allCalendarData);
        }

    } catch (err) {
        showLoading(false);
        console.error("Error fetching calendar data: ", err);
        showError(`データ取得エラー: ${err.message || JSON.stringify(err)}`);
    }
}

// --- 表示ロジック (renderDailyMatrixView, renderWeeklyRoomViewなど) ---
// full_view.js のものをベースに、gapiから取得したデータ構造に合わせて調整
// (基本的には同じデータ構造を想定して作られているため、大きな変更は不要なはず)
// ... (renderDailyMatrixView, renderWeeklyRoomView, その他のヘルパー関数は full_view.js と同様) ...

// 以下、full_view.js から必要な関数をコピー＆ペースト
// (initialize, handleViewChange, updateViewControls, navigateDay, navigateWeek, updateWeekDisplay,
//  formatEventTimeForTooltip, renderDailyMatrixView, renderWeeklyRoomView,
//  showLoading, showError, getMonday, formatDate)

// --- (例) renderDailyMatrixView の呼び出し部分の修正イメージ ---
// (renderDailyMatrixView 自体のロジックは full_view.js とほぼ同じで良いはず)
// function renderDailyMatrixView(calendarsEventData) { ... }

// --- (例) full_view.js からコピーする関数群 ---
function initialize() {
    // ... (DOM要素の取得は上記で行っているので、イベントリスナー設定など) ...
    if (resourceCalendarItems.length === 0) {
        showError("確認するリソースカレンダーが設定されていません。");
        // fetchButton.disabled = true; // fetchButton はこのファイルでは主要ではない
        return;
    }
    resourceCalendarItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id; option.textContent = item.name; roomSelector.appendChild(option);
    });
    if (currentSelectedRoomId) roomSelector.value = currentSelectedRoomId;
    dailyDatePicker.valueAsDate = selectedDate;
    updateWeekDisplay(); 
    updateViewControls(); 
    // fetchData(); // 初期データ取得は認証後に行う
    
    // Event Listeners
    // if (fetchButton) { fetchButton.addEventListener('click', fetchData); } // fetchDataは認証後に実行
    viewSelectorRadios.forEach(radio => radio.addEventListener('change', handleViewChange));
    dailyDatePicker.addEventListener('change', () => { selectedDate = dailyDatePicker.valueAsDate; fetchData(); });
    prevDayBtn.addEventListener('click', () => navigateDay(-1)); nextDayBtn.addEventListener('click', () => navigateDay(1));
    roomSelector.addEventListener('change', () => { currentSelectedRoomId = roomSelector.value; fetchData(); });
    prevWeekBtn.addEventListener('click', () => navigateWeek(-1)); nextWeekBtn.addEventListener('click', () => navigateWeek(1));
}
// ... (他の関数も同様に full_view.js から持ってくる) ...
// (showLoading, showError, getMonday, formatDate, renderDailyMatrixView, renderWeeklyRoomView など)
// ただし、renderDailyMatrixView, renderWeeklyRoomView は、引数として渡される
// calendarsEventData の構造が、gapi.client.calendar.events.list の結果を
// 整形したものになることを想定して調整が必要な場合があります。
// 上記の fetchData 内では、既に整形済みなので、大きな変更は不要なはずです。

// --- ページ読み込み完了時に初期化処理を実行 ---
// (gapiLoaded, gisLoaded が呼ばれた後に認証ボタンが有効化され、
//  ユーザーがサインインしたら fetchData が呼ばれる流れ)
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements (date pickers, selectors etc.)
    // Note: fetchData() will be called after successful sign-in
    // DOM要素の取得
    const fetchButton = document.getElementById('fetchButton'); // This button might be removed or repurposed
    const dataDisplayArea = document.getElementById('dataDisplayArea');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');

    const viewSelectorRadios = document.querySelectorAll('input[name="viewType"]');
    const dailyControlsDiv = document.getElementById('dailyControls');
    const weeklyControlsDiv = document.getElementById('weeklyControls');
    const dailyDatePicker = document.getElementById('dailyDatePicker');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const roomSelector = document.getElementById('roomSelector');
    const weekDisplaySpan = document.getElementById('weekDisplaySpan');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    
    // signInButton, signOutButton はグローバルスコープで取得済み

    initialize(); // UIの初期セットアップ
});

// (showLoading, showError, getMonday, formatDate, renderDailyMatrixView, renderWeeklyRoomView などの関数定義は省略。full_view.jsからコピー)
// ... (full_view.js から必要な関数をここにコピー) ...
// (renderDailyMatrixView と renderWeeklyRoomView は、上記の fetchData から渡されるデータ構造に合わせてください)
// (formatEventTimeForTooltip も必要です)
// (showLoading, showError, getMonday, formatDate も必要です)

// ここに full_view.js からコピーする関数群を記述
// (例)
function showLoading(isLoading) {
    if (loadingDiv) loadingDiv.style.display = isLoading ? 'block' : 'none';
    // if (fetchButton) fetchButton.disabled = isLoading;
}
function showError(message) {
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = message ? 'block' : 'none';
    }
}
function getMonday(d) { d = new Date(d); const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }
function formatDate(date) { const y = date.getFullYear(), m = ('0' + (date.getMonth() + 1)).slice(-2), d = ('0' + date.getDate()).slice(-2); return `${y}/${m}/${d}`; }

// renderDailyMatrixView と renderWeeklyRoomView は full_view.js のものをベースに、
// 引数 calendarsEventData の構造が、上記の fetchData 内で整形された
// allCalendarData と同じであることを確認してください。
// (基本的には同じはずです)
function renderDailyMatrixView(calendarsEventData) {
    // ... (full_view.js の renderDailyMatrixView の内容をここに記述) ...
    // (console.log の接頭辞を [renderDailyMatrixView web] などに変えるとデバッグしやすい)
    console.log('[renderDailyMatrixView web] Called. Event Data:', JSON.stringify(calendarsEventData, null, 2));
    dataDisplayArea.innerHTML = ''; 

    if (resourceCalendarItems.length === 0) {
        console.warn('[renderDailyMatrixView web] No resourceCalendarItems defined.');
        showError("表示対象の会議室が設定されていません。"); return;
    }
    if (!calendarsEventData) {
            console.error('[renderDailyMatrixView web] calendarsEventData is null or undefined.');
            showError("カレンダーデータの取得に失敗しました。"); return;
    }

    const table = document.createElement('table'); table.id = 'dailyMatrixTable';
    const thead = table.createTHead(); 
    const headerRow = thead.insertRow();
    
    const thRoomHeader = document.createElement('th'); 
    thRoomHeader.textContent = '会議室'; 
    headerRow.appendChild(thRoomHeader);

    const startHour = 8; 
    const endHour = 19; 
    const timeSlotInterval = 30; 

    for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += timeSlotInterval) { 
            const thHour = document.createElement('th');
            thHour.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            headerRow.appendChild(thHour);
        }
    }

    const tbody = table.createTBody();
    
    resourceCalendarItems.forEach(room => {
        const roomRow = tbody.insertRow();
        const tdRoomName = roomRow.insertCell();
        tdRoomName.textContent = room.name;
        tdRoomName.title = room.name; 
        tdRoomName.classList.add('matrix-room-name-cell');

        const roomData = calendarsEventData[room.id];

        for (let h = startHour; h < endHour; h++) {
            for (let m = 0; m < 60; m += timeSlotInterval) { 
                const tdHourStatus = roomRow.insertCell();
                const currentProcessingDate = new Date(selectedDate);
                const slotStartTime = new Date(currentProcessingDate); 
                slotStartTime.setHours(h, m, 0, 0);
                const slotEndTime = new Date(currentProcessingDate); 
                slotEndTime.setHours(h, m + timeSlotInterval, 0, 0); 
                
                let overlappingEvent = null; 

                if (roomData && roomData.items && roomData.items.length > 0) {
                    for (const event of roomData.items) {
                        const eventStart = new Date(event.start.dateTime || event.start.date);
                        const eventEnd = new Date(event.end.dateTime || event.end.date);

                        if (eventStart < slotEndTime && eventEnd > slotStartTime) {
                            overlappingEvent = event; 
                            break; 
                        }
                    }
                } else if (roomData && roomData.errorDetails) {
                    // console.warn(...);
                }

                if (overlappingEvent) {
                    tdHourStatus.textContent = overlappingEvent.summary; 
                    
                    const eventTime = formatEventTimeForTooltip(overlappingEvent.start, overlappingEvent.end);
                    let titleDetails = `会議時間: ${eventTime}\n`;
                    titleDetails += `会議名: ${overlappingEvent.summary}\n`;
                    titleDetails += `作成者: ${overlappingEvent.organizer || '(不明)'}\n`;
                    if (overlappingEvent.attendees && overlappingEvent.attendees.length > 0) {
                        titleDetails += `ゲスト: ${overlappingEvent.attendees.join(', ')}`;
                    } else {
                        titleDetails += "ゲスト: なし";
                    }
                    tdHourStatus.title = titleDetails; 
                    tdHourStatus.classList.add('matrix-cell-busy');
                } else {
                    tdHourStatus.classList.add('matrix-cell-available');
                }
            }
        }
    });
    dataDisplayArea.appendChild(table);
}

function renderWeeklyRoomView(calendarsEventData) {
    // ... (full_view.js の renderWeeklyRoomView の内容をここに記述) ...
    console.log('[renderWeeklyRoomView web] Called. Event Data:', JSON.stringify(calendarsEventData, null, 2));
    dataDisplayArea.innerHTML = '';
    const roomData = calendarsEventData[currentSelectedRoomId];
    const room = resourceCalendarItems.find(r => r.id === currentSelectedRoomId);
    
    if (!room) { showError("選択された会議室の情報が見つかりません。"); return; }

    const roomHeader = document.createElement('h3');
    roomHeader.textContent = `${room.name} の週間予定 (${formatDate(currentWeekStartDate)} - ${formatDate(new Date(new Date(currentWeekStartDate).setDate(currentWeekStartDate.getDate() + 6)))})`;
    dataDisplayArea.appendChild(roomHeader);

    const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];

    for (let i = 0; i < 7; i++) {
        const day = new Date(currentWeekStartDate);
        day.setDate(currentWeekStartDate.getDate() + i);
        const dayItemDiv = document.createElement('div');
        dayItemDiv.className = 'weekly-day-item';
        const dayHeader = document.createElement('div');
        dayHeader.className = 'weekly-day-header';
        dayHeader.textContent = `${formatDate(day)} (${daysOfWeek[day.getDay()]})`;
        dayItemDiv.appendChild(dayHeader);
        const statusDiv = document.createElement('div');
        statusDiv.className = 'weekly-status';
        let dayHasEvents = false;

        if (roomData && roomData.items && roomData.items.length > 0) {
            roomData.items.forEach(event => {
                const eventStart = new Date(event.start.dateTime || event.start.date);
                const eventEnd = new Date(event.end.dateTime || event.end.date);
                if (eventStart.getFullYear() === day.getFullYear() &&
                    eventStart.getMonth() === day.getMonth() &&
                    eventStart.getDate() === day.getDate()) {
                    
                    const busyDetails = document.createElement('div');
                    busyDetails.className = 'weekly-busy-details';
                    
                    const eventTime = formatEventTimeForTooltip(event.start, event.end);
                    let detailTextForDisplay = `会議名: ${event.summary} (${eventTime})`;
                    
                    let titleDetails = `会議時間: ${eventTime}\n`;
                    titleDetails += `会議名: ${event.summary}\n`;
                    titleDetails += `作成者: ${event.organizer || '(不明)'}\n`;
                    if (event.attendees && event.attendees.length > 0) {
                        titleDetails += `ゲスト: ${event.attendees.join(', ')}`;
                    } else {
                        titleDetails += "ゲスト: なし";
                    }
                    busyDetails.textContent = detailTextForDisplay; 
                    busyDetails.title = titleDetails; 

                    statusDiv.appendChild(busyDetails);
                    dayHasEvents = true;
                }
            });
        } else if (roomData && roomData.errorDetails) {
                console.warn(`Error fetching events for room ${room.name} (weekly):`, roomData.errorDetails);
        }

        if (dayHasEvents) {
            statusDiv.classList.add('busy');
        } else if (roomData || (roomData && !roomData.errorDetails)) { 
            statusDiv.textContent = '予定なし';
            statusDiv.classList.add('available');
        } else {
                statusDiv.textContent = '情報取得エラー';
                statusDiv.classList.add('busy');
        }
        dayItemDiv.appendChild(statusDiv);
        dataDisplayArea.appendChild(dayItemDiv);
    }
}
