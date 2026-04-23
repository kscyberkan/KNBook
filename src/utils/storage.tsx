function setToStorage(key: string, value: string) {
    localStorage.setItem(key, value)
}

function getFromStorage(key: string) {
    return localStorage.getItem(key)
}

function removeFromStorage(key: string) {
    localStorage.removeItem(key)
}

function clearStorage() {
    localStorage.clear()
}

function setSessionToStorage(key: string, value: string) {
    sessionStorage.setItem(key, value)
}

function getSessionFromStorage(key: string) {
    return sessionStorage.getItem(key)
}
function removeSessionFromStorage(key: string) {
    sessionStorage.removeItem(key)
}
function clearSessionStorage() {
    sessionStorage.clear()
}

const storage = {
    setToStorage,
    getFromStorage,
    removeFromStorage,
    clearStorage,
    setSessionToStorage,
    getSessionFromStorage,
    removeSessionFromStorage,
    clearSessionStorage
}

export default storage