// --- GAPI と GIS の初期化 (グローバルスコープ) ---
let tokenClient;
let gapiInited = false;
let gisInited = false;

// ★★★ GCPで作成したウェブアプリケーション用の情報を設定 ★★★
const API_KEY = 'AIzaSyCpRjx_lkdpcp-eePb-_psrh5MUB-T06aA';
const CLIENT_ID = '976002357617-j8i08ahpphr1frt1ko7tltvfbp847alk.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

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
    const dailyDatePicker = document.getElementById('dailyDatePicker');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const bookingModalBackdrop = document.getElementById('bookingModalBackdrop');
    const bookingModal = document.getElementById('bookingModal');
    const bookingResourceName = document.getElementById('bookingResourceName');
    const bookingStartTimeSelect = document.getElementById('bookingStartTime');
    const bookingEndTimeSelect = document.getElementById('bookingEndTime');
    const eventTitleInput = document.getElementById('eventTitle');
    const targetCalendarSelect = document.getElementById('targetCalendarSelect');
    const saveBookingBtn = document.getElementById('saveBookingBtn');
    const cancelBookingBtn = document.getElementById('cancelBookingBtn');
    
    let bookingData = {};

    // --- Resource Data ---
    const resourceCalendarItems = [
        { name: "J会議室-1", id: "qualitech-pharma.co.jp_1884fiuigavrkglnjs1djjhgku6im6gb6opj8dhg6gq30cpo70@resource.calendar.google.com", type: "room" },
        { name: "J会議室-2", id: "c_188946m97jurmjcln23drb67jt08c@resource.calendar.google.com", type: "room" },
        { name: "J会議室-3", id: "c_188ct4ddraj2sih1l1p8bki4kquua@resource.calendar.google.com", type: "room" },
        { name: "J応接室-1", id: "c_188dv27enmm18gm0l374n8dsp7736@resource.calendar.google.com", type: "room" },
        { name: "J応接室-2", id: "c_1883dlc3656j8iqdhu538n2bjtrug@resource.calendar.google.com", type: "room" },
        { name: "C会議室-1", id: "c_1886tb6nndrgih6fntrba28bbqg3c@resource.calendar.google.com", type: "room" },
        { name: "C会議室-2", id: "c_188e1galv71cqjldlqmcqb9bh13v0@resource.calendar.google.com", type: "room" },
        { name: "KUBOMI", id: "c_1884ppicc7llijpbn2i563577na98@resource.calendar.google.com", type: "room" },
        { name: "TQ会議室-1", id: "c_1889knnqihfeegnuk0difag0k4mva@resource.calendar.google.com", type: "room" },
        { name: "TQ会議室-2", id: "c_188dorsdoishij18ko42f4rmnip9o@resource.calendar.google.com", type: "room" },
        { name: "TQ棟１F 南側", id: "c_1880t51gi8ei6hufjuapnk2s5a7ns@resource.calendar.google.com", type: "room" },
        { name: "TQ棟１F 北側", id: "c_18805c2gtqlrmgamn400g2mfl8gp0@resource.calendar.google.com", type: "room" },
        { name: "A棟包装会議室", id: "c_1884rmjrs0j4kio2kcj3s7ae7aki2@resource.calendar.google.com", type: "room" },
        { name: "ノア", id: "c_188610h41pnu2jrcgtt1daki34ccq@resource.calendar.google.com", type: "car" },
        { name: "アクア", id: "c_1882goec90jfojkigr38jcc72sadu@resource.calendar.google.com", type: "car" }
    ];

    // --- State Variables ---
    let selectedDate = new Date();

    // --- Helper Functions ---
    function showLoading(isLoading) { if (loadingDiv) loadingDiv.style.display = isLoading ? 'block' : 'none'; }
    function showError(message) { if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = message ? 'block' : 'none'; } }
    function formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }
    function formatEventTime(eventStart, eventEnd) {
        const options = { hour: '2-digit', minute: '2-digit' };
        const startTime = new Date(eventStart.dateTime || eventStart.date).toLocaleTimeString('ja-JP', options);
        const endTime = new Date(eventEnd.dateTime || eventEnd.date).toLocaleTimeString('ja-JP', options);
        return `${startTime}～${endTime}`;
    }

    // --- Auth Logic ---
    function handleAuthResponse(resp) {
        if (resp.error !== undefined) {
            if (resp.error === 'popup_closed' || resp.error === 'user_cancel' || resp.error === 'immediate_failed') { signInButton.style.display = 'block'; } else { showError('認証中にエラーが発生しました: ' + JSON.stringify(resp)); signInButton.style.display = 'block'; }
            return;
        }
        signOutButton.style.display = 'block'; signInButton.style.display = 'none'; controlsWrapper.style.display = 'flex';
        gapi.client.setToken({ access_token: resp.access_token });
        fetchData();
        fetchAndPopulateCalendarList();
    }
    function trySilentSignIn() { if (gapiInited && gisInited) { tokenClient.callback = handleAuthResponse; tokenClient.requestAccessToken({ prompt: 'none' }); } }
    signInButton.onclick = () => { tokenClient.callback = handleAuthResponse; tokenClient.requestAccessToken({ prompt: 'consent' }); };
    signOutButton.onclick = () => {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken(''); dataDisplayArea.innerHTML = ''; controlsWrapper.style.display = 'none';
                signInButton.style.display = 'block'; signOutButton.style.display = 'none'; showError('サインアウトしました。');
            });
        }
    };

    // --- Data Fetching & Calendar List ---
    async function fetchAndPopulateCalendarList() {
        try {
            const response = await gapi.client.calendar.calendarList.list();
            const calendars = response.result.items;
            targetCalendarSelect.innerHTML = '';
            calendars.forEach((calendar) => {
                if (calendar.accessRole === 'owner' || calendar.accessRole === 'writer') {
                    const option = document.createElement('option');
                    option.value = calendar.id;
                    option.textContent = calendar.summary;
                    if (calendar.primary) { option.selected = true; }
                    targetCalendarSelect.appendChild(option);
                }
            });
        } catch (err) { console.error("Error fetching calendar list", err); }
    }
    
    async function fetchData() {
        if (!gapi.client.getToken()) { showError("Googleアカウントでサインインしてください。"); return; }
        showLoading(true); showError(''); dataDisplayArea.innerHTML = '';
        const timeMinISO = new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString();
        const timeMaxISO = new Date(new Date(selectedDate).setHours(23, 59, 59, 999)).toISOString();
        const idsToFetchDetails = resourceCalendarItems.map(item => item.id);
        if (idsToFetchDetails.length === 0) { showError("取得対象のリソースがありません。"); showLoading(false); return; }
        const allCalendarData = {};
        try {
            const requests = idsToFetchDetails.map(calendarId => gapi.client.calendar.events.list({ 'calendarId': calendarId, 'timeMin': timeMinISO, 'timeMax': timeMaxISO, 'showDeleted': false, 'singleEvents': true, 'maxResults': 50, 'orderBy': 'startTime' }));
            const responses = await Promise.allSettled(requests);
            responses.forEach((response, index) => {
                const calendarId = idsToFetchDetails[index];
                if (response.status === 'fulfilled' && response.value.result) {
                     allCalendarData[calendarId] = { items: response.value.result.items ? response.value.result.items.map(event => ({ id: event.id, summary: event.summary || '(タイトルなし)', start: event.start, end: event.end, creator: event.creator ? (event.creator.displayName || event.creator.email) : '(作成者不明)', organizer: event.organizer ? (event.organizer.displayName || event.organizer.email) : '(主催者不明)', attendees: event.attendees ? event.attendees.map(att => att.displayName || att.email) : [] })) : [] };
                } else {
                    console.error(`Error fetching events for ${calendarId}:`, response.reason || response.value);
                    allCalendarData[calendarId] = { items: [], errorDetails: response.reason || response.value };
                }
            });
            showLoading(false); renderDailyMatrixView(allCalendarData);
        } catch (err) {
            showLoading(false); console.error("A critical error occurred: ", err); showError(`重大なエラーが発生しました: ${err.message || JSON.stringify(err)}`);
        }
    }

    // --- Booking Modal Logic ---
    function populateTimeSelects(selectElement, selectedTime) {
        selectElement.innerHTML = '';
        const startHour = 8; const endHour = 19; const timeSlotInterval = 15;
        for (let h = startHour; h <= endHour; h++) {
            for (let m = 0; m < 60; m += timeSlotInterval) {
                if (h === endHour && m > 0) continue;
                const option = document.createElement('option');
                const time = new Date(selectedDate);
                time.setHours(h, m, 0, 0);
                option.value = time.toISOString();
                option.textContent = formatTime(time);
                if (formatTime(time) === formatTime(selectedTime)) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            }
        }
    }
    function openBookingModal(room, startTime) {
        const endTime = new Date(startTime.getTime() + 30 * 60000);
        bookingData = { room: room };
        populateTimeSelects(bookingStartTimeSelect, startTime);
        populateTimeSelects(bookingEndTimeSelect, endTime);
        bookingResourceName.textContent = room.name;
        eventTitleInput.value = '';
        bookingModal.style.display = 'block';
        bookingModalBackdrop.style.display = 'block';
    }
    function closeBookingModal() { bookingModal.style.display = 'none'; bookingModalBackdrop.style.display = 'none'; }
    async function createCalendarEvent() {
        const summary = eventTitleInput.value;
        if (!summary) { alert('会議名を入力してください。'); return; }
        const targetCalendarId = targetCalendarSelect.value;
        if (!targetCalendarId) { alert('作成先のカレンダーを選択してください。'); return; }
        const eventResource = {
            'summary': summary,
            'start': { 'dateTime': bookingStartTimeSelect.value, 'timeZone': 'Asia/Tokyo' },
            'end': { 'dateTime': bookingEndTimeSelect.value, 'timeZone': 'Asia/Tokyo' },
            'attendees': [{ 'email': bookingData.room.id }]
        };
        try {
            await gapi.client.calendar.events.insert({ 'calendarId': targetCalendarId, 'resource': eventResource, 'sendUpdates': 'all' });
            alert('予約が作成されました。'); closeBookingModal(); fetchData();
        } catch (err) { console.error('Error creating event:', err); alert(`予約の作成に失敗しました: ${err.result.error.message}`); }
    }
    cancelBookingBtn.onclick = closeBookingModal;
    bookingModalBackdrop.onclick = closeBookingModal;
    saveBookingBtn.onclick = createCalendarEvent;

    // --- Rendering Logic ---
    function renderDailyMatrixView(calendarsEventData) {
        dataDisplayArea.innerHTML = '';
        const table = document.createElement('table'); table.id = 'dailyMatrixTable';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        const thRoomHeader = document.createElement('th');
        thRoomHeader.textContent = 'リソース';
        headerRow.appendChild(thRoomHeader);
        const startHour = 8; const endHour = 19; const timeSlotInterval = 15;
        const slotsPerHour = 60 / timeSlotInterval;
        for (let h = startHour; h < endHour; h++) {
            const thHour = document.createElement('th');
            thHour.colSpan = slotsPerHour;
            thHour.textContent = `${String(h).padStart(2, '0')}:00`;
            headerRow.appendChild(thHour);
        }
        
        const tbody = table.createTBody();
        resourceCalendarItems.forEach((room, index) => {
            const roomRow = tbody.insertRow();
            if (index > 0 && room.type === 'car' && resourceCalendarItems[index - 1].type === 'room') { roomRow.classList.add('group-separator'); }
            if (room.type === 'car') { roomRow.classList.add('car-row'); }
            const tdRoomName = roomRow.insertCell();
            tdRoomName.textContent = room.name;
            tdRoomName.title = room.name;
            const roomData = calendarsEventData[room.id];
            let currentColumn = 0;
            while (currentColumn < (endHour - startHour) * slotsPerHour) {
                const h = startHour + Math.floor(currentColumn / slotsPerHour);
                const m = (currentColumn % slotsPerHour) * timeSlotInterval;
                const slotStartTime = new Date(selectedDate); slotStartTime.setHours(h, m, 0, 0);
                const slotEndTime = new Date(slotStartTime.getTime() + timeSlotInterval * 60000);
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
                if (overlappingEvent) {
                    const eventStart = new Date(overlappingEvent.start.dateTime || overlappingEvent.start.date);
                    if (eventStart >= slotStartTime && eventStart < slotEndTime) {
                       const eventEnd = new Date(overlappingEvent.end.dateTime || overlappingEvent.end.date);
                       const durationInMinutes = (eventEnd - eventStart) / (1000 * 60);
                       const colspanCount = Math.max(1, Math.ceil(durationInMinutes / timeSlotInterval));
                       const tdHourStatus = roomRow.insertCell();
                       tdHourStatus.colSpan = colspanCount;
                       tdHourStatus.textContent = `> ${formatEventTime(overlappingEvent.start, overlappingEvent.end)} ${overlappingEvent.summary}`;
                       let titleDetails = `会議時間: ${formatEventTime(overlappingEvent.start, overlappingEvent.end)}\n会議名: ${overlappingEvent.summary}\n作成者: ${overlappingEvent.creator || overlappingEvent.organizer || '(不明)'}\nゲスト: ${overlappingEvent.attendees && overlappingEvent.attendees.length > 0 ? overlappingEvent.attendees.join(', ') : "なし"}`;
                       tdHourStatus.title = titleDetails;
                       tdHourStatus.classList.add('matrix-cell-busy', 'event-start');
                       currentColumn += colspanCount;
                    } else {
                        currentColumn++;
                    }
                } else {
                    const tdHourStatus = roomRow.insertCell();
                    tdHourStatus.classList.add('matrix-cell-available');
                    tdHourStatus.onclick = () => openBookingModal(room, slotStartTime);
                    currentColumn++;
                }
            }
        });
        dataDisplayArea.appendChild(table);
    }
    
    // --- UI Control Logic ---
    function navigateDay(offset) {
        selectedDate.setDate(selectedDate.getDate() + offset);
        dailyDatePicker.valueAsDate = selectedDate;
        if (gapi.client.getToken()) fetchData();
    }

    // --- App Initialization ---
    (function initializeApp() {
        if (resourceCalendarItems.length === 0) { showError("確認するリソースカレンダーが設定されていません。"); return; }
        dailyDatePicker.valueAsDate = selectedDate;
        dailyDatePicker.addEventListener('change', () => { selectedDate = dailyDatePicker.valueAsDate; if (gapi.client.getToken()) fetchData(); });
        prevDayBtn.addEventListener('click', () => navigateDay(-1));
        nextDayBtn.addEventListener('click', () => navigateDay(1));
        document.addEventListener('gapiReady', trySilentSignIn);
        document.addEventListener('gisReady', trySilentSignIn);
        trySilentSignIn();
    })();
});
