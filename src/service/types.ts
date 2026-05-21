export interface UserInfo {
    name: string;
    description: string;
}

export type Message = {
    id?: string;
    role: "user" | "assistant" | "system";
    content: string;
};