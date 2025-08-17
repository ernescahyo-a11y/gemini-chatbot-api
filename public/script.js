// Enhanced Chatbot Frontend Logic
class GeminiChatbot {
    constructor() {
        this.form = document.getElementById('chat-form');
        this.input = document.getElementById('user-input');
        this.chatBox = document.getElementById('chat-box');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.attachmentBtn = document.querySelector('.attachment-btn');
        
        this.apiEndpoint = 'http://localhost:3000/api/chat';
        this.conversationHistory = [];
        this.isProcessing = false;
        
        // File upload setup
        this.createFileInput();
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.hideWelcomeMessage();
        this.testConnection(); // Test connection on load
    }
    
    // BARU: Test koneksi ke backend
    async testConnection() {
        try {
            const response = await fetch('http://localhost:3000/api/health');
            if (response.ok) {
                this.updateConnectionStatus(true);
                console.log('✅ Backend connected successfully');
            } else {
                throw new Error('Backend not responding');
            }
        } catch (error) {
            this.updateConnectionStatus(false);
            console.error('❌ Backend connection failed:', error);
            this.showNotification('Backend tidak terhubung. Pastikan server berjalan di port 3000.', 'error');
        }
    }
    
    // BARU: Buat hidden file input untuk upload
    createFileInput() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*,audio/*,.pdf,.doc,.docx,.txt';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);
        
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
    
    bindEvents() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // BARU: File attachment button
        this.attachmentBtn.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // Input focus effects
        this.input.addEventListener('focus', () => {
            this.input.parentElement.style.transform = 'scale(1.02)';
        });
        
        this.input.addEventListener('blur', () => {
            this.input.parentElement.style.transform = 'scale(1)';
        });
        
        // Auto-resize input and enter key handling
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.form.dispatchEvent(new Event('submit'));
            }
        });
        
        // Typing indicator for better UX
        let typingTimer;
        this.input.addEventListener('input', () => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                // Add subtle typing effect here if needed
            }, 300);
        });
    }
    
    // BARU: Handle file selection
    async handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showNotification('File terlalu besar. Maksimal 10MB.', 'error');
            return;
        }
        
        // Show file selected
        this.appendMessage('user', `📎 File terpilih: ${file.name} (${this.formatFileSize(file.size)})`);
        
        // Process file
        await this.processFile(file);
        
        // Clear file input
        this.fileInput.value = '';
    }
    
    // BARU: Process different file types
    async processFile(file) {
        this.isProcessing = true;
        this.showTypingIndicator();
        
        try {
            const formData = new FormData();
            formData.append('prompt', 'Tolong analisis file ini dan berikan ringkasan yang berguna.');
            
            let endpoint;
            
            // Determine endpoint based on file type
            if (file.type.startsWith('image/')) {
                formData.append('image', file);
                endpoint = 'http://localhost:3000/generate-from-image';
            } else if (file.type.startsWith('audio/')) {
                formData.append('audio', file);
                endpoint = 'http://localhost:3000/generate-from-audio';
            } else {
                // Documents (PDF, DOC, TXT, etc.)
                formData.append('document', file);
                endpoint = 'http://localhost:3000/generate-from-document';
            }
            
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.result) {
                await this.typeMessage('bot', data.result);
            } else {
                await this.typeMessage('bot', '🤔 Maaf, saya tidak bisa memproses file ini. Coba dengan file lain.');
            }
            
        } catch (error) {
            console.error('File processing error:', error);
            await this.typeMessage('bot', '⚠️ Terjadi kesalahan saat memproses file. Pastikan server backend berjalan.');
        } finally {
            this.hideTypingIndicator();
            this.isProcessing = false;
        }
    }
    
    // BARU: Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isProcessing) return;
        
        const userMessage = this.input.value.trim();
        if (!userMessage) return;
        
        // Add user message to conversation history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        
        // Display user message
        this.appendMessage('user', userMessage);
        this.input.value = '';
        this.isProcessing = true;
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send request to backend
            const response = await this.sendToAPI(userMessage);
            
            if (response && response.result) {
                // Add AI response to conversation history
                this.conversationHistory.push({
                    role: 'assistant',
                    content: response.result
                });
                
                // Display AI response with typing animation
                await this.typeMessage('bot', response.result);
            } else {
                await this.typeMessage('bot', '🤔 Maaf, saya tidak menerima respons yang proper. Coba tanya lagi?');
            }
        } catch (error) {
            console.error('Chat error:', error);
            
            // More specific error messages
            if (error.message.includes('Failed to fetch')) {
                await this.typeMessage('bot', '⚠️ Tidak bisa terhubung ke server. Pastikan backend berjalan di port 3000.');
            } else {
                await this.typeMessage('bot', '⚠️ Terjadi kesalahan. Silakan coba lagi.');
            }
        } finally {
            this.hideTypingIndicator();
            this.isProcessing = false;
        }
    }
    
    async sendToAPI(message) {
        const requestBody = {
            messages: [
                ...this.conversationHistory.slice(-10), // Keep last 10 messages for context
                { role: 'user', content: message }
            ]
        };
        
        console.log('Sending to API:', this.apiEndpoint, requestBody);
        
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    appendMessage(sender, text, isTyping = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', sender);
        
        const avatar = document.createElement('div');
        avatar.classList.add('message-avatar');
        
        if (sender === 'user') {
            avatar.innerHTML = '<i class="fas fa-user"></i>';
        } else {
            avatar.innerHTML = '<i class="fas fa-robot"></i>';
        }
        
        const content = document.createElement('div');
        content.classList.add('message-content');
        content.textContent = text;
        
        messageElement.appendChild(avatar);
        messageElement.appendChild(content);
        
        this.chatBox.appendChild(messageElement);
        this.scrollToBottom();
        
        return content; // Return content element for typing animation
    }
    
    async typeMessage(sender, text) {
        const contentElement = this.appendMessage(sender, '', true);
        const words = text.split(' ');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
            currentText += (i > 0 ? ' ' : '') + words[i];
            contentElement.textContent = currentText;
            
            // Add typing cursor effect
            contentElement.innerHTML = currentText + '<span class="typing-cursor">|</span>';
            
            // Variable speed based on word length
            const delay = Math.max(30, Math.min(100, words[i].length * 20));
            await this.sleep(delay);
            
            this.scrollToBottom();
        }
        
        // Remove typing cursor
        contentElement.innerHTML = currentText;
        
        // Add subtle fade-in effect for the completed message
        contentElement.style.opacity = '0.7';
        setTimeout(() => {
            contentElement.style.opacity = '1';
        }, 100);
    }
    
    showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }
    
    hideWelcomeMessage() {
        // Hide welcome message after first interaction
        setTimeout(() => {
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage && this.conversationHistory.length > 0) {
                welcomeMessage.style.opacity = '0';
                welcomeMessage.style.transform = 'translateY(-20px)';
                setTimeout(() => {
                    welcomeMessage.style.display = 'none';
                }, 300);
            }
        }, 1000);
    }
    
    scrollToBottom() {
        requestAnimationFrame(() => {
            this.chatBox.scrollTop = this.chatBox.scrollHeight;
        });
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // BARU: Show notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add notification styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#3B82F6'};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    // Utility method to clear conversation
    clearConversation() {
        this.conversationHistory = [];
        this.chatBox.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-sparkles"></i>
                </div>
                <h2>Welcome to AI Chatbot</h2>
                <p>Your intelligent assistant powered by Google's advanced AI. Ask me anything!</p>
            </div>
        `;
    }
    
    // Method to handle connection status
    updateConnectionStatus(isOnline) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span');
        
        if (statusDot && statusText) {
            if (isOnline) {
                statusDot.className = 'status-dot online';
                statusText.textContent = 'Online';
            } else {
                statusDot.className = 'status-dot offline';
                statusText.textContent = 'Offline';
            }
        }
    }
}

// Enhanced error handling and connection monitoring
class ConnectionMonitor {
    constructor(chatbot) {
        this.chatbot = chatbot;
        this.init();
    }
    
    init() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.chatbot.updateConnectionStatus(true);
            this.chatbot.showNotification('Koneksi internet pulih!', 'success');
            this.chatbot.testConnection(); // Re-test backend connection
        });
        
        window.addEventListener('offline', () => {
            this.chatbot.updateConnectionStatus(false);
            this.chatbot.showNotification('Koneksi internet terputus.', 'warning');
        });
        
        // Initial status
        this.chatbot.updateConnectionStatus(navigator.onLine);
    }
}

// Add notification animations to CSS
const notificationStyles = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .typing-cursor {
        animation: blink 1s infinite;
        color: #667eea;
    }
    
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const chatbot = new GeminiChatbot();
    const connectionMonitor = new ConnectionMonitor(chatbot);
    
    // Global chatbot instance for debugging
    window.chatbot = chatbot;
    
    console.log('🤖 Gemini AI Chatbot initialized successfully!');
    console.log('💡 Pro tip: You can access the chatbot instance via window.chatbot for debugging');
});

// Service Worker registration for better offline experience (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}