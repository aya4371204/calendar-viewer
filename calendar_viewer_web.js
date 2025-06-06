// --- GAPI と GIS の初期化 (グローバルスコープ) ---
let tokenClient;
let gapiInited = false;
let gisInited = false;

// ★★★ GCPで作成したウェブアプリケーション用の情報を設定 ★★★
const API_KEY = 'AIzaSyCpRjx_lkdpcp-eePb-_psrh5MUB-T06aA';
const CLIENT_ID = '976002357617-j8i08ahpphr1frt1ko7tltvfbp847alk.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.readonly';

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    });
    gapiInited = true;
    document.dispatchEvent(new Event('gapiReady'));
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    document.dispatchEvent(new Event('gisReady'));
}

// --- メインのアプリケーションロジック ---
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const signInButton = document.getElementById('signInButton');
    const signOutButton = document.getElementById('signOutButton');
    const controlsWrapper = document.getElementById('controls-wrapper');
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

    // --- Resource Data ---
    const resourceCalendarItems = [
        { name: "J会議室-1", id: "qualitech-pharma.co.jp_1884fiuigavrkglnjs1djjhgku6im6gb6opj8dhg6gq30cpo70@resource.calendar.google.com" },
        { name: "J会議室-2", id: "c_188946m97jurmjcln23drb67jt08c@resource.calendar.google.com" },
        { name: "J会議室-3", id: "c_188ct4ddraj2sih1l1p8bki4kquua@resource.calendar.google.com" },
        { name: "C会議室-1", id: "c_1886tb6nndrgih6fntrba28bbqg3c@resource.calendar.google.com" },
        { name: "C会議室-2", id: "c_188e1galv71cqjldlqmcqb9bh13v0@resource.calendar.google.com" },
        { name: "J応接室-1", id: "c_188dv27enmm18gm0l374n8dsp7736@resource.calendar.google.com" },
        { name: "J応接室-2", id: "c_1883dlc3656j8iqdhu538n2bjtrug@resource.calendar.google.com" },
        { name: "TQ会議室-1", id: "c_1889knnqihfeegnuk0difag0k4mva@resource.calendar.google.com" },
        { name: "TQ会議室-2", id: "c_188dorsdoishij18ko42f4rmnip9o@resource.calendar.google.com" },
        { name: "KUBOMI", id: "c_1884ppicc7llijpbn2i563577na98@resource.calendar.google.com" },
        { name: "A棟包装会議室", id: "c_1884rmjrs0j4kio2kcj3s7ae7aki2@resource.calendar.google.com" },
        { name: "TQ棟１F 南側", id: "c_1880t51gi8ei6hufjuapnk2s5a7ns@resource.calendar.google.com" },
        { name: "TQ棟１F 北側", id: "c_18805c2gtqlrmgamn400g2mfl8gp0@resource.calendar.google.com" },
        { name: "ノア", id: "c_188610h41pnu2jrcgtt1daki34ccq@resource.calendar.google.com" },
        { name: "アクア", id: "c_1882goec90jfojkigr38jcc72sadu@resource.calendar.google.com" }
    ];

    // --- State Variables ---
    let currentView = 'dailyMatrix';
    let selectedDate = new Date();
    let currentSelectedRoomId = resourceCalendarItems.length > 0 ? resourceCalendarItems[0].id : null;
    let currentWeekStartDate = getMonday(new Date());

    // --- Helper Functions ---
    function showLoading(isLoading) { if (loadingDiv) loadingDiv.style.display = isLoading ? 'block' : 'none'; }
    function showError(message) { if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = message ? 'block' : 'none'; } }
    function getMonday(d) { d = new Date(d); const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }
    function formatDate(date) { const y = date.getFullYear(), m = ('0' + (date.getMonth() + 1)).slice(-2), d = ('0' + date.getDate()).slice(-2); return `${y}/${m}/${d}`; }
    function formatEventTimeForTooltip(eventStart, eventEnd) {
        const options = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' };
        const startTime = new Date(eventStart.dateTime || eventStart.date).toLocaleTimeString('ja-JP', options);
        const endTime = new Date(eventEnd.dateTime || eventEnd.date).toLocaleTimeString('ja-JP', options);
        return `${startTime}～${endTime}`;
    }

    // --- GAPI/GIS readiness check ---
    function maybeEnableAuthButtons() { if (gapiInited && gisInited) { signInButton.style.display = 'block'; } }

    // --- Auth Logic ---
    signInButton.onclick = () => {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                showError('認証中にエラーが発生しました: ' + JSON.stringify(resp));
                throw (resp);
            }
            signOutButton.style.display = 'block';
            signInButton.style.display = 'none';
            controlsWrapper.style.display = 'block';
            gapi.client.setToken({ access_token: resp.access_token });
            fetchData();
        };
        if (gapi.client.getToken() === null) { tokenClient.requestAccessToken({ prompt: 'consent' }); } else { tokenClient.requestAccessToken({ prompt: '' }); }
    };

    signOutButton.onclick = () => {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                dataDisplayArea.innerHTML = '';
                controlsWrapper.style.display = 'none';
                signInButton.style.display = 'block';
                signOutButton.style.display = 'none';
                showError('サインアウトしました。');
            });
        }
    };

    // --- Data Fetching ---
    async function fetchData() {
        if (!gapi.client.getToken()) { showError("Googleアカウントでサインインしてください。"); return; }
        showLoading(true); showError(''); dataDisplayArea.innerHTML = '';
        let timeMinISO, timeMaxISO, idsToFetchDetails = [];
        if (currentView === 'dailyMatrix') {
            timeMinISO = new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString();
            timeMaxISO = new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString();
            idsToFetchDetails = resourceCalendarItems.map(item => item.id);
        } else {
            if (!currentSelectedRoomId) { showError("会議室が選択されていません。"); showLoading(false); return; }
            const weekEnd = new Date(currentWeekStartDate); weekEnd.setDate(currentWeekStartDate.getDate() + 6);
            timeMinISO = new Date(new Date(currentWeekStartDate).setHours(0, 0, 0, 0)).toISOString();
            timeMaxISO = new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString();
            idsToFetchDetails = [currentSelectedRoomId];
        }
        if (idsToFetchDetails.length === 0) { showError("取得対象のリソースがありません。"); showLoading(false); return; }

        const allCalendarData = {};
        try {
            const requests = idsToFetchDetails.map(calendarId => gapi.client.calendar.events.list({ 'calendarId': calendarId, 'timeMin': timeMinISO, 'timeMax': timeMaxISO, 'showDeleted': false, 'singleEvents': true, 'maxResults': 50, 'orderBy': 'startTime' }));
            const responses = await Promise.all(requests);
            responses.forEach((response, index) => {
                const calendarId = idsToFetchDetails[index];
                if (response.result.items) {
                    allCalendarData[calendarId] = {
                        items: response.result.items.map(event => ({ id: event.id, summary: event.summary || '(タイトルなし)', start: event.start, end: event.end, organizer: event.organizer ? (event.organizer.displayName || event.organizer.email) : '(主催者不明)', attendees: event.attendees ? event.attendees.map(att => att.displayName || att.email) : [] }))
                    };
                }
            });
            showLoading(false);
            if (currentView === 'dailyMatrix') renderDailyMatrixView(allCalendarData); else renderWeeklyRoomView(allCalendarData);
        } catch (err) {
            showLoading(false); console.error("Error fetching calendar data: ", err); showError(`データ取得エラー: ${err.result ? err.result.error.message : JSON.stringify(err)}`);
        }
    }

    // --- Rendering Logic ---
    function renderDailyMatrixView(calendarsEventData) {
        dataDisplayArea.innerHTML = '';
        const table = document.createElement('table'); table.id = 'dailyMatrixTable';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const thRoomHeader = document.createElement('th');
        thRoomHeader.textContent = '会議室';
        headerRow.appendChild(thRoomHeader);
        const startHour = 8; const endHour = 19; const timeSlotInterval = 30;
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
            const roomData = calendarsEventData[room.id];
            let slotsToSkip = 0;
            for (let h = startHour; h < endHour; h++) {
                for (let m = 0; m < 60; m += timeSlotInterval) {
                    if (slotsToSkip > 0) {
                        slotsToSkip--;
                        continue;
                    }
                    const slotStartTime = new Date(selectedDate); slotStartTime.setHours(h, m, 0, 0);
                    const slotEndTime = new Date(selectedDate); slotEndTime.setHours(h, m + timeSlotInterval, 0, 0);
                    let overlappingEvent = null;
                    if (roomData && roomData.items) {
                        for (const event of roomData.items) {
                            const eventStart = new Date(event.start.dateTime || event.start.date);
                            const eventEnd = new Date(event.end.dateTime || event.end.date);
                            if (eventStart < slotEndTime && eventEnd > slotStartTime) {
                                overlappingEvent = event;
                                break;
                            }
                        }
                    }
                    const tdHourStatus = roomRow.insertCell();
                    if (overlappingEvent) {
                        const eventStart = new Date(overlappingEvent.start.dateTime || overlappingEvent.start.date);
                        const eventEnd = new Date(overlappingEvent.end.dateTime || overlappingEvent.end.date);
                        const durationInMinutes = (eventEnd - eventStart) / (1000 * 60);
                        const colspanCount = Math.ceil(durationInMinutes / timeSlotInterval);
                        slotsToSkip = colspanCount - 1;
                        tdHourStatus.colSpan = colspanCount;
                        tdHourStatus.textContent = overlappingEvent.summary;
                        const eventTime = formatEventTimeForTooltip(overlappingEvent.start, overlappingEvent.end);
                        let titleDetails = `会議時間: ${eventTime}\n会議名: ${overlappingEvent.summary}\n作成者: ${overlappingEvent.organizer || '(不明)'}\nゲスト: ${overlappingEvent.attendees && overlappingEvent.attendees.length > 0 ? overlappingEvent.attendees.join(', ') : "なし"}`;
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
        // ... (renderWeeklyRoomView のロジックは変更なし) ...
    }

    // --- UI Control Logic ---
    function handleViewChange(event) { currentView = event.target.value; updateViewControls(); if (gapi.client.getToken()) fetchData(); }
    function updateViewControls() { dailyControlsDiv.style.display = currentView === 'dailyMatrix' ? 'block' : 'none'; weeklyControlsDiv.style.display = currentView === 'weeklyRoom' ? 'block' : 'none'; }
    function navigateDay(offset) { selectedDate.setDate(selectedDate.getDate() + offset); dailyDatePicker.valueAsDate = selectedDate; if (gapi.client.getToken()) fetchData(); }
    function navigateWeek(offset) { currentWeekStartDate.setDate(currentWeekStartDate.getDate() + (offset * 7)); updateWeekDisplay(); if (gapi.client.getToken()) fetchData(); }
    function updateWeekDisplay() { const e = new Date(currentWeekStartDate); e.setDate(currentWeekStartDate.getDate() + 6); weekDisplaySpan.textContent = `${formatDate(currentWeekStartDate)} - ${formatDate(e)}`; }

    // --- App Initialization ---
    (function initializeApp() {
        if (resourceCalendarItems.length === 0) { showError("確認するリソースカレンダーが設定されていません。"); return; }
        resourceCalendarItems.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.name; roomSelector.appendChild(option); });
        if (currentSelectedRoomId) roomSelector.value = currentSelectedRoomId;
        dailyDatePicker.valueAsDate = selectedDate; updateWeekDisplay(); updateViewControls();
        viewSelectorRadios.forEach(radio => radio.addEventListener('change', handleViewChange));
        dailyDatePicker.addEventListener('change', () => { selectedDate = dailyDatePicker.valueAsDate; if (gapi.client.getToken()) fetchData(); });
        prevDayBtn.addEventListener('click', () => navigateDay(-1)); nextDayBtn.addEventListener('click', () => navigateDay(1));
        roomSelector.addEventListener('change', () => { currentSelectedRoomId = roomSelector.value; if (gapi.client.getToken()) fetchData(); });
        prevWeekBtn.addEventListener('click', () => navigateWeek(-1)); nextWeekBtn.addEventListener('click', () => navigateWeek(1));
        document.addEventListener('gapiReady', maybeEnableAuthButtons); document.addEventListener('gisReady', maybeEnableAuthButtons);
        maybeEnableAuthButtons();
    })();
});
