// Client → Server
export enum PacketCS {
    // Auth
    LOGIN           = 1,
    REGISTER        = 2,
    LOGOUT          = 3,
    RESUME          = 4,   // re-authenticate ด้วย token หลัง reconnect

    // Post
    CREATE_POST     = 10,
    DELETE_POST     = 11,
    GET_FEED        = 12,
    GET_USER_POSTS  = 13,
    EDIT_POST       = 14,

    // Reaction
    REACT_POST      = 20,
    UNREACT_POST    = 21,

    // Comment
    CREATE_COMMENT  = 30,
    DELETE_COMMENT  = 31,
    EDIT_COMMENT    = 32,

    // Chat
    SEND_MESSAGE    = 40,
    GET_CONVERSATION = 41,
    READ_MESSAGES   = 42,

    // Notification
    GET_NOTIFICATIONS       = 50,
    MARK_NOTIFICATION_READ  = 51,
    MARK_ALL_NOTIF_READ     = 52,

    // Profile
    UPDATE_PROFILE_IMAGE    = 60,
    UPDATE_COVER_IMAGE      = 61,
    UPDATE_PROFILE          = 62,

    // Friend
    SEND_FRIEND_REQUEST     = 70,
    ACCEPT_FRIEND_REQUEST   = 71,
    REMOVE_FRIEND           = 72,
    GET_FRIENDS             = 73,
    GET_FRIEND_STATUS       = 74,
    GET_PENDING_REQUESTS    = 75,
    GET_SENT_REQUESTS       = 76,
    GET_FRIENDS_PANEL       = 77,
    HANDLE_FRIEND_NOTIF     = 78,
    GET_USER_BY_ID          = 79,
    SEARCH_USERS            = 80,
    REPORT_POST             = 90,
    BOOKMARK_POST           = 91,
    UNBOOKMARK_POST         = 92,
    GET_BOOKMARKS           = 93,
    REACT_MESSAGE           = 94,
    UNREACT_MESSAGE         = 95,
    GET_BOOKMARK_IDS        = 96,
    BLOCK_USER              = 97,
    UNBLOCK_USER            = 98,
    GET_BLOCKED_USERS       = 99,
}

// Server → Client
export enum PacketSC {
    // Auth
    ACCEPT_LOGIN    = 1,
    REJECT_LOGIN    = 2,
    ACCEPT_REGISTER = 3,
    REJECT_REGISTER = 4,
    RESUME_OK       = 5,   // server ยืนยัน session แล้ว

    // Post
    POST_LIST       = 10,
    USER_POST_LIST  = 14,
    NEW_POST        = 11,
    POST_DELETED    = 12,
    POST_UPDATED    = 13,

    // Reaction
    REACTION_UPDATE = 20,       // broadcast: reaction เปลี่ยน

    // Comment
    NEW_COMMENT     = 30,
    COMMENT_DELETED = 31,
    COMMENT_UPDATED = 32,

    // Chat
    MESSAGE_LIST    = 40,
    NEW_MESSAGE     = 41,       // push: ได้รับข้อความใหม่
    MESSAGE_READ    = 42,       // push: ข้อความถูกอ่านแล้ว

    // Notification
    NOTIFICATION_LIST   = 50,
    NEW_NOTIFICATION    = 51,   // push: แจ้งเตือนใหม่

    // Error
    ERROR           = 99,

    // Profile
    PROFILE_IMAGE_UPDATED = 60,
    COVER_IMAGE_UPDATED   = 61,
    PROFILE_UPDATED       = 62,
    USER_DATA             = 64,
    SEARCH_RESULTS        = 65,

    // Friend
    FRIEND_STATUS         = 70,
    FRIEND_LIST           = 71,  // ตอบกลับ GET_FRIENDS (PageManager)
    FRIEND_LIST_PANEL     = 75,  // ตอบกลับ GET_FRIENDS (FriendsPanel)
    PENDING_REQUESTS      = 72,
    SENT_REQUESTS         = 73,
    FRIEND_REQUEST_RECV   = 74,
    FRIEND_UPDATE       = 76,

    // Force logout
    FORCE_LOGOUT    = 80,

    // Report
    REPORT_OK       = 90,

    // Online status
    FRIEND_ONLINE   = 91,  // push: เพื่อนออนไลน์/ออฟไลน์

    // Bookmark
    BOOKMARK_LIST   = 92,
    BOOKMARK_UPDATE = 93,

    // Message reaction
    MESSAGE_REACTION_UPDATE = 94,

    // Bookmark IDs
    BOOKMARK_IDS    = 95,

    // Block
    BLOCK_UPDATE    = 96,
    BLOCKED_LIST    = 97,
}