import storage from "../../utils/storage";
import { type LoginData } from "../types/login_data";
import { authFunction } from "./auth";
import { Global } from "../Global";
import net from "../network/client";

const loginDataKey = "loginData";

function setLoginData(data: LoginData) {
    Global.user.id           = data.id;
    Global.user.name         = data.name;
    Global.user.profileImage = data.profileImage ?? '';
    Global.user.coverImage   = data.coverImage;
    Global.user.nickname     = data.nickname;
    Global.user.phone        = data.phone;
    Global.user.province     = data.province;
    Global.user.bio          = data.bio;
    Global.user.createdAt    = data.createdAt;

    storage.setToStorage(loginDataKey, JSON.stringify(data));
    authFunction.setLoginData(data);
}

function removeLoginData() {
    storage.removeFromStorage(loginDataKey);
    authFunction.setLoginData(false);
    net.logout();
}

function getLoginData(): LoginData | false {
    const raw = storage.getFromStorage(loginDataKey);
    if (!raw) return false;
    try {
        const data = JSON.parse(raw) as LoginData;
        Global.user.id           = data.id;
        Global.user.name         = data.name;
        Global.user.profileImage = data.profileImage ?? '';
        Global.user.coverImage   = data.coverImage;
        Global.user.nickname     = data.nickname;
        Global.user.phone        = data.phone;
        Global.user.province     = data.province;
        Global.user.bio          = data.bio;
        Global.user.createdAt    = data.createdAt;
        return data;
    } catch {
        return false;
    }
}

export function updateStoredField(fields: Partial<LoginData>): void {
    const raw = storage.getFromStorage(loginDataKey);
    if (!raw) return;
    try {
        const data = JSON.parse(raw) as LoginData;
        storage.setToStorage(loginDataKey, JSON.stringify({ ...data, ...fields }));
    } catch { /* ignore */ }
}

const auth = { setLoginData, getLoginData, removeLoginData };
export default auth;
