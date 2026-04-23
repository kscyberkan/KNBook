import auth from "../function";
import net from "../../network/client";
import { PacketSC } from "../../network/packetList";
import Packet from "../../network/packet";
import { type RegisterData } from "../../../types/register_data";
import { modal } from "../../../components/Modal";

function SendRegister(registerData: RegisterData) {
    const fullName = `${registerData.name} ${registerData.lastname}`.trim();

    const unsubOk = net.on(PacketSC.ACCEPT_REGISTER, (packet: Packet) => {
        const id           = String(packet.readInt());
        const name         = packet.readString();
        const profileImage = packet.readString();
        const token        = packet.readString();
        const nickname     = packet.readString();
        const phone        = packet.readString();
        const province     = packet.readString();
        auth.setLoginData({ id, username: registerData.username, name, token, profileImage, nickname, phone, province });
        unsubOk();
        unsubFail();
    });

    const unsubFail = net.on(PacketSC.REJECT_REGISTER, (packet: Packet) => {
        const msg = packet.readString();
        modal.error(msg, 'สมัครสมาชิกไม่สำเร็จ');
        unsubOk();
        unsubFail();
    });

    net.register(registerData.username, registerData.password, fullName, registerData.nickname, registerData.phone, registerData.address);
}

const register = { Register: SendRegister };
export default register;
