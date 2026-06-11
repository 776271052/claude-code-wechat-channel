// WeChat ilink API internal types — used by wechat-api, media, cdn, typing

export type MediaKind = 'image' | 'voice' | 'file' | 'video'

export interface CDNMedia {
  encrypt_query_param?: string
  aes_key?: string
  encrypt_type?: number
  full_url?: string
}

export interface TextItem { text?: string }
export interface ImageItem { media?: CDNMedia; thumb_media?: CDNMedia; aeskey?: string; url?: string; mid_size?: number; thumb_size?: number; thumb_height?: number; thumb_width?: number; hd_size?: number }
export interface VoiceItem { media?: CDNMedia; encode_type?: number; bits_per_sample?: number; sample_rate?: number; playtime?: number; text?: string }
export interface FileItem { media?: CDNMedia; file_name?: string; md5?: string; len?: string }
export interface VideoItem { media?: CDNMedia; video_size?: number; play_length?: number; video_md5?: string; thumb_media?: CDNMedia; thumb_size?: number; thumb_height?: number; thumb_width?: number }
export interface RefMessage { message_item?: MessageItem; title?: string }
export interface MessageItem { type?: number; text_item?: TextItem; image_item?: ImageItem; voice_item?: VoiceItem; file_item?: FileItem; video_item?: VideoItem; ref_msg?: RefMessage }

export interface WeixinMessage {
  from_user_id?: string; to_user_id?: string; client_id?: string; session_id?: string; group_id?: string
  message_type?: number; message_state?: number; item_list?: MessageItem[]; context_token?: string; create_time_ms?: number
}

export interface GetUpdatesResp { ret?: number; errcode?: number; errmsg?: string; msgs?: WeixinMessage[]; get_updates_buf?: string; longpolling_timeout_ms?: number }
export interface GetConfigResp { typing_ticket?: string; ret?: number }
