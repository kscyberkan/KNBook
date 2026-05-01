import auth from "../function";
import net from "../../network/client";
import { PacketSC } from "../../network/packetList";
import Packet from "../../network/packet";
import { modal } from "../../../components/Modal";

function SendLogin(username: string, password: string) {
    const unsubOk = net.on(PacketSC.ACCEPT_LOGIN, (packet: Packet) => {
        const id           = String(packet.readInt());
        const name         = packet.readString();
        const profileImage = packet.readString();
        const token        = packet.readString();
        const nickname     = packet.readString();
        const phone        = packet.readString();
        const province     = packet.readString();
        const bio          = packet.readString();
        const coverImage   = packet.readString();
        const createdAt    = packet.readString();
        const lang         = packet.readString() || 'th';
        auth.setLoginData({ id, username, name, token, profileImage, nickname, phone, province, bio, coverImage: coverImage || undefined, createdAt: createdAt || undefined, lang });
        unsubOk();
        unsubFail();
    });

    const unsubFail = net.on(PacketSC.REJECT_LOGIN, (packet: Packet) => {
        const msg = packet.readString();
        modal.error(msg, 'เข้าสู่ระบบไม่สำเร็จ');
        unsubOk();
        unsubFail();
    });

    net.login(username, password);
}

const login = { Login: SendLogin };
export default login;
