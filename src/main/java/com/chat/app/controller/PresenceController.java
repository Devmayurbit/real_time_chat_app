package com.chat.app.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class PresenceController {

    private final SimpMessagingTemplate messagingTemplate;
    private static final Set<String> onlineUsers = ConcurrentHashMap.newKeySet();

    public PresenceController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // 👤 User joins
    @MessageMapping("/join")
    public void join(String username) {
        if (username == null || username.isBlank()) return;

        onlineUsers.add(username);
        messagingTemplate.convertAndSend("/topic/online", onlineUsers);
    }

    // 👋 User leaves
    @MessageMapping("/leave")
    public void leave(String username) {
        onlineUsers.remove(username);
        messagingTemplate.convertAndSend("/topic/online", onlineUsers);
    }

    // ✍ Typing indicator
    @MessageMapping("/typing")
    public void typing(String username) {
        messagingTemplate.convertAndSend("/topic/typing", username);
    }
}
