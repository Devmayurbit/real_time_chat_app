import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";
import gsap from "gsap";
import * as THREE from "three";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");

  const containerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const stompClient = useRef(null);
  const typingTimeout = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef([]);

  // 🎥 3D Canvas Setup & Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    // Create Particles
    const particleCount = 150;
    const particles = [];
    const geometry = new THREE.BufferGeometry();
    const positions = [];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      positions.push(x, y, z);
      particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 0.5,
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    const material = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    particlesRef.current = particles;

    // Add some floating cubes
    const cubes = [];
    for (let i = 0; i < 5; i++) {
      const geom = new THREE.BoxGeometry(8, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      });
      const cube = new THREE.Mesh(geom, mat);
      cube.position.set(
        (Math.random() - 0.5) * 150,
        (Math.random() - 0.5) * 150,
        (Math.random() - 0.5) * 150
      );
      cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(cube);
      cubes.push(cube);
    }

    // Mouse tracking
    const onMouseMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Handle resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Update particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        if (Math.abs(p.x) > 100) p.vx *= -1;
        if (Math.abs(p.y) > 100) p.vy *= -1;
        if (Math.abs(p.z) > 100) p.vz *= -1;
      });

      const positions = geometry.attributes.position.array;
      particles.forEach((p, i) => {
        positions[i * 3] = p.x + mouseRef.current.x * 20;
        positions[i * 3 + 1] = p.y + mouseRef.current.y * 20;
        positions[i * 3 + 2] = p.z;
      });
      geometry.attributes.position.needsUpdate = true;

      // Rotate cubes
      cubes.forEach((cube) => {
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.008;
        cube.position.x += Math.sin(Date.now() * 0.0005 + cube.position.y) * 0.2;
        cube.position.y += Math.cos(Date.now() * 0.0007 + cube.position.x) * 0.2;
      });

      // Camera orbit
      camera.position.x = Math.sin(Date.now() * 0.0003) * 80;
      camera.position.y = Math.cos(Date.now() * 0.0002) * 80;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    // GSAP Entrance
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, scale: 0.9, y: 40 },
      { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: "power4.out" }
    );

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      cubes.forEach(c => c.geometry.dispose());
    };
  }, []);

  // 🔌 WebSocket Connect
  useEffect(() => {
    const client = new Client({
      brokerURL: "ws://localhost:8080/ws",
      reconnectDelay: 3000,
      debug: () => {},

      onConnect: () => {
        console.log("✅ Connected");
        setConnected(true);

        // Messages
        client.subscribe("/topic/messages", (msg) => {
          const data = JSON.parse(msg.body);
          setMessages((prev) => [...prev, data]);
        });

        // Online users
       client.subscribe("/topic/users", (msg) => {
  const users = JSON.parse(msg.body);
  setOnlineUsers(users);
});


        // Typing
        client.subscribe("/topic/typing", (msg) => {
          const user = msg.body;
          setTypingUser(user);

          clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => {
            setTypingUser("");
          }, 1500);
        });
      },

      onDisconnect: () => {
        console.log("❌ Disconnected");
        setConnected(false);
      },
    });

    client.activate();
    stompClient.current = client;

    return () => client.deactivate();
  }, []);

  // ⬇ Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🚀 Join Chat
  const joinChat = () => {
    if (!sender.trim() || !stompClient.current?.connected) return;

    stompClient.current.publish({
      destination: "/app/join",
      body: sender.trim(),
    });
  };

  // ✍ Typing Event
  const sendTyping = () => {
    if (!sender || !stompClient.current?.connected) return;

    stompClientompClientSafe(() =>
      stompClient.current.publish({
        destination: "/app/typing",
        body: sender,
      })
    );
  };

  // ✉ Send Message
  const sendMessage = () => {
    if (!connected || !sender.trim() || !message.trim()) return;

    stompClient.current.publish({
      destination: "/app/sendMessage",
      body: JSON.stringify({
        sender: sender.trim(),
        content: message.trim(),
      }),
    });

    setMessage("");
  };

  // 🛡 Safety wrapper
  const StompClientSafe = (fn) => {
    try {
      fn();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 overflow-hidden">
      {/* 3D Background Canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ pointerEvents: "none" }}
      />

      {/* Chat Container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl rounded-3xl p-6 backdrop-blur-xl bg-black/40 border border-white/10 shadow-[0_0_40px_rgba(56,189,248,0.25)] z-10"
      >
        {/* Glow */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-sky-500/20 to-fuchsia-500/20 blur-2xl -z-10" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-white">⚡ NeoChat</h1>
            <p className="text-xs text-slate-400">
              Online: {onlineUsers.length}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-green-400 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-slate-300">
              {connected ? "Connected" : "Offline"}
            </span>
          </div>
        </div>

        {/* Online Users */}
        <div className="flex flex-wrap gap-2 mb-2">
          {onlineUsers.map((u) => (
            <span
              key={u}
              className="text-xs bg-white/10 px-3 py-1 rounded-full text-sky-300"
            >
              {u}
            </span>
          ))}
        </div>

        {/* Typing */}
        {typingUser && typingUser !== sender && (
          <p className="text-xs text-fuchsia-400 animate-pulse mb-2">
            {typingUser} is typing...
          </p>
        )}

        {/* Messages */}
        <div className="h-[320px] overflow-y-auto space-y-3 pr-1 custom-scroll">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/10 p-3 text-sm text-white backdrop-blur"
            >
              <span className="text-sky-400 font-semibold">
                {msg.sender}
              </span>
              <span className="mx-2 text-slate-400">•</span>
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Inputs */}
        <div className="mt-4 space-y-3">
          <input
            placeholder="Your name..."
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            onBlur={joinChat}
            className="w-full rounded-xl bg-white/10 px-4 py-2 text-white outline-none"
          />

          <div className="flex gap-3">
            <input
              placeholder="Type message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                sendTyping();
              }}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-white outline-none"
            />

            <button
              onClick={sendMessage}
              disabled={!connected}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-fuchsia-500 px-5 py-2 font-medium text-black hover:scale-105 transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
