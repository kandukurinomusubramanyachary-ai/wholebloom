import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS, createThemedStyles, LAYOUT, WEB_FOCUS } from '../utils/constants';
import {
  MEG_MODES,
  buildMegContext,
  describeMegContext,
  megService,
} from '../services/meg';
import { createClientMegQaTiming } from '../services/megQaTiming';
import {
  recoverableMegRequest,
  setMegMessageDelivery,
} from '../services/megLocalQueue';
import { Entrance, useReducedMotion } from '../components/Motion';
import { LotusMark } from '../components/BrandMark';

let idCounter = 0;

const MEG_SHELL_WIDTH = 430;
const PRIMARY_MODES = MEG_MODES.slice(0, 3).map((mode, index) => ({
  ...mode,
  label: ['Just listen', 'Help me understand', 'One small next step'][index],
  activeLabel: ['Just listening', 'Help me understand', 'One small next step'][index],
}));

const CONVERSATION_STARTERS = [
  {
    id: 'my-symptoms',
    text: 'Help me understand my symptoms.',
    mode: null,
  },
  {
    id: 'my-cycle',
    text: 'Help me understand my cycle.',
    mode: null,
  },
  {
    id: 'my-mood',
    text: 'I want to talk about my mood.',
    mode: null,
  },
  {
    id: 'food-ideas',
    text: 'Can you help me think through food ideas?',
    mode: null,
  },
  {
    id: 'my-pattern',
    text: 'Help me understand a pattern I noticed.',
    mode: null,
  },
];

const INITIAL_MESSAGE_COUNT = 30;

function createId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function sortNewestFirst(conversations) {
  return [...conversations].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );
}

function collectRememberedMessages(conversations, currentId) {
  return conversations
    .filter((conversation) => conversation.id !== currentId)
    .flatMap((conversation) => conversation.messages || [])
    .filter((message) => message.role === 'user')
    .slice(-10);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(() => {
    if (Platform.OS !== 'web' || typeof globalThis.navigator === 'undefined') return true;
    return globalThis.navigator.onLine !== false;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof globalThis.window === 'undefined') return undefined;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    globalThis.window.addEventListener('online', handleOnline);
    globalThis.window.addEventListener('offline', handleOffline);
    return () => {
      globalThis.window.removeEventListener('online', handleOnline);
      globalThis.window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}

function ContextPanel({ context }) {
  const details = describeMegContext(context);

  return (
    <View style={styles.contextPanel}>
      <View style={styles.contextTop}>
        <View style={styles.contextIcon}>
          <Ionicons name='leaf-outline' size={18} color={COLORS.sage} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.contextTitle}>Bloom context</Text>
          <Text style={styles.contextBody}>
            {details.length
              ? 'Meg receives only the relevant details shown here for this message.'
              : 'No check-in details are being added to this conversation.'}
          </Text>
        </View>
      </View>

      {details.length ? (
        <View style={styles.contextDetails}>
          {details.map((detail) => (
            <View key={detail} style={styles.contextChip}>
              <Text style={styles.contextChipText}>{detail}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ModePicker({ selectedMode, onSelect, compact = false }) {
  return (
    <View
      style={[styles.modeRow, compact && styles.compactModeRow]}
      accessibilityRole='radiogroup'
      accessibilityLabel='Choose how Meg should support you'
    >
      {PRIMARY_MODES.map((mode) => {
        const selected = selectedMode === mode.id;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onSelect(mode.id)}
            accessibilityRole='radio'
            accessibilityState={{ checked: selected }}
            accessibilityLabel={mode.label}
            style={({ pressed, hovered, focused }) => [
              styles.modeChip,
              compact && styles.compactModeChip,
              styles.interactiveMotion,
              hovered && !selected && styles.modeChipHovered,
              focused && styles.interactiveFocus,
              selected && styles.modeChipSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
              {mode.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ConversationStarters({ onSelect, disabled }) {
  return (
    <View style={styles.promptSection}>
      <Text style={styles.promptLabel}>If words feel hard, you can start here</Text>
      <View style={styles.promptList}>
        {CONVERSATION_STARTERS.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => onSelect(prompt)}
            disabled={disabled}
            accessibilityRole='button'
            accessibilityLabel={`Start with: ${prompt.text}`}
            accessibilityState={{ disabled }}
            style={({ pressed, hovered, focused }) => [
              styles.promptButton,
              styles.interactiveMotion,
              hovered && styles.promptHovered,
              focused && styles.interactiveFocus,
              pressed && styles.promptPressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.promptText}>{prompt.text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FeedbackControls({ value, onSelect, disabled }) {
  return (
    <View style={styles.feedbackRow}>
      <Text style={styles.feedbackLabel}>Helpful?</Text>
      {[
        { id: 'helpful', label: 'Helpful', icon: 'thumbs-up-outline' },
        { id: 'not_helpful', label: 'Not helpful', icon: 'thumbs-down-outline' },
      ].map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            hitSlop={{ left: 2, right: 2 }}
            disabled={disabled}
            accessibilityRole='button'
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            style={({ pressed, hovered, focused }) => [
              styles.feedbackButton,
              styles.interactiveMotion,
              hovered && !selected && styles.interactiveHover,
              focused && styles.interactiveFocus,
              selected && styles.feedbackButtonSelected,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={15}
              color={selected ? COLORS.brand : COLORS.muted}
            />

          </Pressable>
        );
      })}
    </View>
  );
}

function messageTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, onFeedback, onCopy, feedbackDisabled, animate = false }) {
  const isUser = message.role === 'user';

  if (isUser) {
    const bubble = (
      <View style={styles.userMessageRow}>
        <View style={styles.userBubble}>
          <Text selectable style={styles.messageText}>{message.text}</Text>
          {message.deliveryStatus === 'pending' ? (
            <Text style={styles.deliveryStatus}>Sending…</Text>
          ) : null}
          {message.deliveryStatus === 'failed' ? (
            <Text style={[styles.deliveryStatus, styles.deliveryStatusFailed]}>
              Meg has not replied yet · retry below
            </Text>
          ) : null}
          {messageTime(message.createdAt) ? (
            <Text style={[styles.messageTime, styles.userMessageTime]}>{messageTime(message.createdAt)}</Text>
          ) : null}
        </View>
      </View>
    );
    return animate ? <Entrance distance={6} duration={210}>{bubble}</Entrance> : bubble;
  }

  const bubble = (
    <View style={styles.assistantMessageRow}>
      <View style={[styles.megAvatar, message.safety && styles.safetyAvatar]}>
        {message.safety ? (
          <Ionicons name='alert-circle-outline' size={19} color={COLORS.warning} />
        ) : (
          <LotusMark size={20} color={COLORS.logo} />
        )}
      </View>
      <View style={styles.assistantColumn}>
        <Text style={styles.assistantName}>{message.safety ? 'Important care note' : 'Meg'}</Text>
        <View style={[styles.assistantBubble, message.safety && styles.safetyBubble]}>
          <Text selectable style={styles.messageText}>{message.text}</Text>
        </View>
        <View style={styles.messageMetaRow}>
          {messageTime(message.createdAt) ? (
            <Text style={styles.messageTime}>{messageTime(message.createdAt)}</Text>
          ) : null}
          <Pressable
            onPress={() => onCopy(message)}
            accessibilityRole='button'
            accessibilityLabel='Copy Meg message'
            style={({ pressed, focused }) => [
              styles.copyButton,
              focused && styles.interactiveFocus,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name='copy-outline' size={14} color={COLORS.muted} />
            <Text style={styles.copyLabel}>Copy</Text>
          </Pressable>
        </View>
        <FeedbackControls value={message.feedback} onSelect={(value) => onFeedback(message.id, value)} disabled={feedbackDisabled} />
      </View>
    </View>
  );
  return animate ? <Entrance distance={6} duration={230}>{bubble}</Entrance> : bubble;
}

function TypingBubble() {
  const reduceMotion = useReducedMotion();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.38))).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    const animation = Animated.loop(
      Animated.stagger(90, dots.map((dot) => Animated.sequence([
        Animated.timing(dot, { toValue: 1, duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(dot, { toValue: 0.38, duration: 190, easing: Easing.bezier(0.77, 0, 0.175, 1), useNativeDriver: Platform.OS !== 'web' }),
      ])))
    );
    animation.start();
    return () => animation.stop();
  }, [dots, reduceMotion]);

  return (
    <Entrance distance={5} duration={190}>
      <View style={styles.assistantMessageRow} accessibilityLiveRegion='polite'>
        <View style={styles.megAvatar}>
          <LotusMark size={20} color={COLORS.logo} />
        </View>
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            {dots.map((dot, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.typingDot,
                  {
                    opacity: dot,
                    transform: [{ translateY: dot.interpolate({ inputRange: [0.38, 1], outputRange: [1, -1] }) }],
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.typingText}>Meg is thinking with you…</Text>
        </View>
      </View>
    </Entrance>
  );
}

function StatusBanner({ type, text, actionLabel, onAction }) {
  const isError = type === 'error';
  return (
    <View
      style={[styles.statusBanner, isError ? styles.errorBanner : styles.offlineBanner]}
      accessibilityRole={isError ? 'alert' : 'status'}
    >
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'cloud-offline-outline'}
        size={20}
        color={isError ? COLORS.error : COLORS.warning}
      />
      <Text style={styles.statusText}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole='button'
          style={({ pressed }) => [styles.statusAction, pressed && styles.pressed]}
        >
          <Text style={styles.statusActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MegScreen({ route }) {
  const {
    state,
    saveSettings,
    saveMegConversation = async () => {},
    saveMegFeedback = async () => {},
    deleteMegConversation = async () => {},
    clearMegHistory = async () => {},
  } = useApp();
  const conversations = Array.isArray(state.megConversations) ? state.megConversations : [];
  const memoryEnabled = !!state.settings?.megMemory;
  const online = useOnlineStatus();
  const reduceMotion = useReducedMotion();
  const context = useMemo(() => buildMegContext(state), [
    state.averageCycleLength,
    state.checkins,
    state.currentCycleDay,
    state.currentPhase,
    state.meals,
    state.movements,
    state.periods,
    state.profile,
    state.settings,
    state.todayCheckin,
  ]);
  const latestSaved = useMemo(() => sortNewestFirst(conversations)[0] || null, [conversations]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMode, setSelectedMode] = useState(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [failedRequest, setFailedRequest] = useState(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState(null);
  const [clearingConversation, setClearingConversation] = useState(false);
  const [visibleMessageCount, setVisibleMessageCount] = useState(INITIAL_MESSAGE_COUNT);
  const initialised = useRef(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const latestMessageY = useRef(0);
  const sendLockRef = useRef(false);

  function scrollLatestMessageIntoView() {
    scrollRef.current?.scrollTo({
      y: Math.max(0, latestMessageY.current + 20),
      animated: false,
    });
  }

  useEffect(() => {
    if (initialised.current) return;
    if (latestSaved) {
      setCurrentConversationId(latestSaved.id);
      const loadedMessages = latestSaved.messages || [];
      const loadedMode = latestSaved.mode || latestSaved.supportMode || null;
      setMessages(loadedMessages);
      setVisibleMessageCount(INITIAL_MESSAGE_COUNT);
      setSelectedMode(loadedMode);
      const recoverable = recoverableMegRequest(loadedMessages, latestSaved.id, loadedMode);
      if (recoverable) {
        setFailedRequest(recoverable);
        setError('Meg could not finish this reply.');
      }
    }
    initialised.current = true;
  }, [latestSaved]);

  useEffect(() => {
    if (!messages.length && !typing) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
    }, 40);
    return () => clearTimeout(timer);
  }, [messages, reduceMotion, typing]);

  useEffect(() => {
    if (!composerFocused || !messages.length) return;
    const timer = setTimeout(() => {
      scrollLatestMessageIntoView();
    }, 250);
    return () => clearTimeout(timer);
  }, [composerFocused, messages.length]);

  useEffect(() => {
    if (!initialised.current || !currentConversationId) return;
    const stillSaved = conversations.some(
      (conversation) => conversation.id === currentConversationId
    );
    if (!stillSaved && !typing) {
      resetConversation('Saved Meg history was cleared from your Bloom account.');
    }
  }, [conversations, currentConversationId, typing]);

  useEffect(() => {
    const suggestedPrompt = route?.params?.prompt;
    if (suggestedPrompt) setInput(suggestedPrompt);
  }, [route?.params?.prompt]);

  function resetConversation(message = '') {
    setCurrentConversationId(null);
    setMessages([]);
    setSelectedMode(null);
    setInput('');
    setError(null);
    setFailedRequest(null);
    setManageOpen(false);
    setModePickerOpen(false);
    setConfirmAction(null);
    setNotice(message);
    setVisibleMessageCount(INITIAL_MESSAGE_COUNT);
  }

  async function persistConversation(id, nextMessages, mode, qaTiming) {
    const existing = conversations.find((conversation) => conversation.id === id);
    const now = new Date().toISOString();
    const firstUserMessage = nextMessages.find((message) => message.role === 'user');
    const conversation = {
      ...existing,
      id,
      mode: mode || existing?.mode || null,
      title: existing?.title || firstUserMessage?.text?.slice(0, 64) || 'Conversation with Meg',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      messages: nextMessages,
    };

    const persistStartedAt = qaTiming?.mark();
    try {
      await saveMegConversation(conversation);
    } finally {
      qaTiming?.recordLocalPersist(persistStartedAt);
    }
  }

  async function requestReply(request, qaTiming = createClientMegQaTiming()) {
    const pendingMessages = setMegMessageDelivery(
      request.baseMessages,
      request.messageId,
      'pending'
    );
    const pendingRequest = { ...request, baseMessages: pendingMessages };
    setTyping(true);
    setError(null);
    setNotice('');
    setFailedRequest(null);
    setMessages(pendingMessages);

    try {
      await persistConversation(
        request.conversationId,
        pendingMessages,
        request.mode,
        qaTiming
      );
    } catch {
      setNotice('Your message is still here on this device.');
    }

    try {
      const memory = memoryEnabled
        ? collectRememberedMessages(conversations, request.conversationId)
        : [];
      const result = await megService.send({
        message: request.message,
        conversationId: request.conversationId,
        messageId: request.messageId,
        mode: request.mode,
        supportMode: request.mode,
        language: state.profile?.language || state.settings?.language || 'en',
        context,
        history: pendingMessages,
        memory,
        ...(qaTiming ? { qaTiming } : {}),
      });
      const resolvedConversationId = result.conversationId || request.conversationId;
      const assistantMessage = {
        id: result.messageId || createId('meg-message'),
        role: 'assistant',
        text: result.text,
        createdAt: new Date().toISOString(),
        safety: result.safety || null,
        source: result.source || 'local',
      };
      const sentMessages = setMegMessageDelivery(
        pendingMessages,
        request.messageId,
        'sent'
      );
      const nextMessages = [...sentMessages, assistantMessage];
      setCurrentConversationId(resolvedConversationId);
      setMessages(nextMessages);
      if (qaTiming) {
        requestAnimationFrame(() => qaTiming.markVisibleReply());
      }

      try {
        await persistConversation(
          resolvedConversationId,
          nextMessages,
          request.mode,
          qaTiming
        );
      } catch (saveError) {
        setNotice('Meg replied, but this screen could not refresh the conversation summary.');
      }
      qaTiming?.completeSuccess();
    } catch (requestError) {
      const failedMessages = setMegMessageDelivery(
        pendingMessages,
        request.messageId,
        'failed'
      );
      const retryRequest = { ...pendingRequest, baseMessages: failedMessages };
      setMessages(failedMessages);
      setError(
        requestError?.message
          || 'Meg couldn\'t respond right now. Please try again.'
      );
      setFailedRequest(retryRequest);
      try {
        await persistConversation(
          request.conversationId,
          failedMessages,
          request.mode,
          qaTiming
        );
      } catch {
        setNotice('Your message remains visible, but Bloom could not save the retry state.');
      }
      qaTiming?.completeFailure();
    } finally {
      setTyping(false);
      if (Platform.OS === 'web') {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  }

  async function handleSend(overrideText, overrideMode) {
    const messageText = String(overrideText ?? input).trim();
    if (!messageText || typing || sendLockRef.current) return;
    sendLockRef.current = true;
    const qaTiming = createClientMegQaTiming();

    const mode = overrideMode || selectedMode || null;
    const conversationId = currentConversationId || createId('meg-conversation');
    const userMessage = {
      id: createId('meg-message'),
      role: 'user',
      text: messageText,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'pending',
    };
    const baseMessages = [...messages, userMessage];

    setCurrentConversationId(conversationId);
    setMessages(baseMessages);
    setSelectedMode(mode);
    setInput('');
    setModePickerOpen(false);
    setTyping(true);

    try {
      try {
        await persistConversation(conversationId, baseMessages, mode, qaTiming);
      } catch (saveError) {
        setNotice('Your message is still here. Bloom will keep trying to save the conversation.');
      }
      await requestReply({
        message: messageText,
        messageId: userMessage.id,
        mode,
        conversationId,
        baseMessages,
      }, qaTiming);
    } finally {
      sendLockRef.current = false;
    }
  }

  async function handleCopyMessage(message) {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(String(message?.text || ''));
      setNotice('Meg’s message was copied.');
    } catch (copyError) {
      setNotice('That message could not be copied. You can still select the text.');
    }
  }

  async function handleFeedback(messageId, feedback) {
    if (feedbackMessageId || !currentConversationId) return;
    setFeedbackMessageId(messageId);
    const previousMessages = messages;
    const selectedFeedback = messages.find((message) => message.id === messageId)?.feedback === feedback
      ? null
      : feedback;
    const nextMessages = messages.map((message) =>
      message.id === messageId
        ? { ...message, feedback: selectedFeedback }
        : message
    );
    setMessages(nextMessages);
    try {
      await saveMegFeedback(currentConversationId, messageId, selectedFeedback);
    } catch (feedbackError) {
      setMessages(previousMessages);
      setNotice('Your feedback could not be saved. Please try again.');
    } finally {
      setFeedbackMessageId(null);
    }
  }

  async function handleMemoryToggle(nextValue) {
    if (savingMemory) return;
    setSavingMemory(true);
    setError(null);
    try {
      await saveSettings({ megMemory: nextValue });
      setNotice(
        nextValue
          ? 'Memory is on. Prior conversations can help inform Meg\'s replies.'
          : 'Memory is off. Prior conversations will not inform new replies.'
      );
    } catch (settingsError) {
      setError('The memory setting could not be changed. Please try again.');
    } finally {
      setSavingMemory(false);
    }
  }

  async function confirmClear() {
    if (clearingConversation) return;
    const action = confirmAction;
    setClearingConversation(true);
    setError(null);
    try {
      if (action === 'current') {
        if (currentConversationId) await deleteMegConversation(currentConversationId);
        resetConversation('The current conversation was cleared.');
      }
      if (action === 'history') {
        await clearMegHistory();
        resetConversation('Saved Meg history was cleared from your Bloom account.');
      }
    } catch (clearError) {
      setError('That conversation could not be cleared. Please try again.');
      setConfirmAction(null);
    } finally {
      setClearingConversation(false);
    }
  }

  function handleComposerKeyPress(event) {
    if (Platform.OS !== 'web') return;
    const keyEvent = event?.nativeEvent || {};
    if (keyEvent.key !== 'Enter' || keyEvent.shiftKey || keyEvent.isComposing) return;
    event.preventDefault?.();
    keyEvent.preventDefault?.();
    handleSend();
  }

  const hasConversation = messages.length > 0;
  const visibleMessages = messages.slice(-visibleMessageCount);
  const selectedPrimaryMode = PRIMARY_MODES.find((mode) => mode.id === selectedMode);
  const selectedModeLabel = selectedPrimaryMode?.activeLabel
    || MEG_MODES.find((mode) => mode.id === selectedMode)?.label;
  const requestLooksUnavailable = !online
    || /(unavailable|failed to fetch|network|connection|service|ollama|https?|timeout|timed out|reach)/i.test(error || '');
  const requestErrorText = requestLooksUnavailable
    ? 'Meg is unavailable for a moment. Your message is still here.'
    : 'Meg couldn’t respond just now. Your message is still here.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.shell}>
          <View style={styles.header}>
            <View style={styles.headerIdentity}>
              <View style={styles.headerMark} accessibilityElementsHidden>
                <LotusMark size={27} color={COLORS.logo} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Meg</Text>
                <View style={styles.statusLine}>
                  <View style={styles.statusDot} />
                  <Text style={styles.subtitle}>Here with you</Text>
                </View>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => resetConversation('A new conversation is ready.')}
                disabled={typing}
                accessibilityRole='button'
                accessibilityLabel='Start a new conversation'
                accessibilityState={{ disabled: typing }}
                style={({ pressed, hovered, focused }) => [
                  styles.iconButton,
                  styles.interactiveMotion,
                  hovered && styles.iconButtonHovered,
                  focused && styles.interactiveFocus,
                  pressed && styles.pressed,
                  typing && styles.disabled,
                ]}
              >
                <Ionicons name='create-outline' size={21} color={COLORS.ink} />
              </Pressable>
              <Pressable
                onPress={() => {
                  setManageOpen(true);
                  setConfirmAction(null);
                }}
                disabled={typing}
                accessibilityRole='button'
                accessibilityLabel='Open Meg privacy and conversation controls'
                accessibilityState={{ expanded: manageOpen, disabled: typing }}
                style={({ pressed, hovered, focused }) => [
                  styles.iconButton,
                  styles.interactiveMotion,
                  hovered && styles.iconButtonHovered,
                  focused && styles.interactiveFocus,
                  pressed && styles.pressed,
                  typing && styles.disabled,
                ]}
              >
                <Ionicons name='ellipsis-horizontal' size={22} color={COLORS.ink} />
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={() => {
              setManageOpen(true);
              setConfirmAction(null);
            }}
            hitSlop={{ top: 3, bottom: 3 }}
            accessibilityRole='button'
            accessibilityLabel='Open privacy and memory controls'
            style={({ pressed, hovered, focused }) => [
              styles.privacyLine,
              styles.interactiveMotion,
              hovered && styles.privacyLineHovered,
              focused && styles.interactiveFocus,
              pressed && styles.privacyLinePressed,
            ]}
          >
            <Ionicons name='lock-closed-outline' size={13} color={COLORS.sage} />
            <Text style={styles.privacyLineText}>
              Stored securely · You control what Meg remembers
            </Text>
            <Ionicons name='chevron-forward' size={14} color={COLORS.muted} />
          </Pressable>

          {!online ? (
            <View style={styles.statusStack}>
              <StatusBanner
                type='offline'
                text='You’re offline right now. Your conversation is still here.'
              />
            </View>
          ) : null}

          {error && !failedRequest ? (
            <View style={styles.statusStack}>
              <StatusBanner type='error' text={error} />
            </View>
          ) : null}

          {notice ? (
            <View style={styles.notice} accessibilityRole='status'>
              <Ionicons name='checkmark-circle-outline' size={17} color={COLORS.sage} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            onLayout={() => {
              if (composerFocused) {
                scrollLatestMessageIntoView();
              }
            }}
            contentContainerStyle={[
              styles.scrollContent,
              !hasConversation && styles.emptyScrollContent,
              hasConversation && styles.conversationScrollContent,
            ]}
            keyboardShouldPersistTaps='handled'
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            showsVerticalScrollIndicator={false}
          >
            {!hasConversation ? (
              <Entrance distance={8} duration={240}>
                <View style={styles.welcome}>
                  <View style={styles.welcomeAvatar} accessibilityElementsHidden>
                    <LotusMark size={40} color={COLORS.logo} />
                  </View>
                  <Text style={styles.welcomeTitle}>Hey, I’m Meg.</Text>
                  <Text style={styles.welcomeBody}>
                    You don’t need to explain everything perfectly. Start with what feels heaviest right now.
                  </Text>

                  <ConversationStarters
                    onSelect={(prompt) => handleSend(prompt.text, prompt.mode)}
                    disabled={typing}
                  />

                  <View style={styles.modeSection}>
                    <Text style={styles.modePrompt}>How should I be with you right now?</Text>
                    <ModePicker selectedMode={selectedMode} onSelect={setSelectedMode} />
                  </View>

                  <Text style={styles.firstUseSafety}>
                    Meg offers support, not medical diagnosis.
                  </Text>
                </View>
              </Entrance>
            ) : (
              <View style={styles.messages}>
                {messages.length > visibleMessages.length ? (
                  <Pressable
                    onPress={() => setVisibleMessageCount((count) => count + INITIAL_MESSAGE_COUNT)}
                    accessibilityRole='button'
                    accessibilityLabel='Show earlier messages'
                    style={({ pressed, focused }) => [
                      styles.earlierMessages,
                      focused && styles.interactiveFocus,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name='chevron-up' size={15} color={COLORS.brand} />
                    <Text style={styles.earlierMessagesText}>Show earlier messages</Text>
                  </Pressable>
                ) : null}
                {visibleMessages.map((message, index) => (
                  <View
                    key={message.id}
                    onLayout={index === visibleMessages.length - 1 ? (event) => {
                      latestMessageY.current = event.nativeEvent.layout.y
                        + (message.role === 'assistant' ? 20 : 0);
                    } : undefined}
                  >
                    <MessageBubble
                      message={message}
                      onFeedback={handleFeedback}
                      onCopy={handleCopyMessage}
                      feedbackDisabled={typing || Boolean(feedbackMessageId)}
                      animate={index >= visibleMessages.length - 2}
                    />
                  </View>
                ))}
                {typing ? <TypingBubble /> : null}
                {error && failedRequest ? (
                  <StatusBanner
                    type='error'
                    text={requestErrorText}
                    actionLabel='Try again'
                    onAction={() => requestReply(failedRequest)}
                  />
                ) : null}
              </View>
            )}
          </ScrollView>

          <View style={styles.composerWrap}>
            {hasConversation ? (
              <View style={styles.modeDock}>
                <Pressable
                  onPress={() => setModePickerOpen((value) => !value)}
                  accessibilityRole='button'
                  accessibilityLabel={`Current support style: ${selectedModeLabel || 'Meg will follow your lead'}. Change support style.`}
                  accessibilityState={{ expanded: modePickerOpen }}
                  style={({ pressed, hovered, focused }) => [
                    styles.modeSummary,
                    styles.interactiveMotion,
                    hovered && styles.modeSummaryHovered,
                    focused && styles.interactiveFocus,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name='heart-outline' size={15} color={COLORS.brand} />
                  <Text style={styles.modeSummaryText}>
                    {selectedModeLabel || 'Meg will follow your lead'}
                  </Text>
                  <Ionicons
                    name={modePickerOpen ? 'chevron-down' : 'chevron-up'}
                    size={14}
                    color={COLORS.muted}
                  />
                </Pressable>
                {modePickerOpen ? (
                  <Entrance distance={5} duration={180}>
                    <ModePicker
                      compact
                      selectedMode={selectedMode}
                      onSelect={(mode) => {
                        setSelectedMode(mode);
                        setModePickerOpen(false);
                      }}
                    />
                  </Entrance>
                ) : null}
              </View>
            ) : null}

            <View
              style={[
                styles.composer,
                composerFocused && styles.composerFocused,
                composerFocused && !reduceMotion && styles.composerLifted,
              ]}
            >
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                editable={!typing}
                multiline
                maxLength={600}
                placeholder='Tell Meg what’s on your mind…'
                placeholderTextColor={COLORS.muted}
                selectionColor={COLORS.brand}
                style={styles.input}
                textAlignVertical='top'
                scrollEnabled
                blurOnSubmit={false}
                onFocus={() => setComposerFocused(true)}
                onBlur={() => setComposerFocused(false)}
                onKeyPress={handleComposerKeyPress}
                accessibilityLabel='Message Meg'
                accessibilityHint='On desktop, press Enter to send or Shift and Enter for a new line.'
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={!input.trim() || typing}
                accessibilityRole='button'
                accessibilityLabel='Send message to Meg'
                accessibilityState={{ disabled: !input.trim() || typing, busy: typing }}
                style={({ pressed, hovered, focused }) => [
                  styles.sendButton,
                  styles.interactiveMotion,
                  hovered && input.trim() && !typing && styles.sendButtonHovered,
                  focused && styles.interactiveFocus,
                  (!input.trim() || typing) && styles.sendButtonDisabled,
                  pressed && input.trim() && !typing && styles.pressed,
                ]}
              >
                <Ionicons
                  name={typing ? 'ellipsis-horizontal' : 'arrow-up'}
                  size={21}
                  color={input.trim() && !typing ? COLORS.white : COLORS.muted}
                />
              </Pressable>
            </View>
          </View>

          <Modal
            visible={manageOpen}
            transparent
            animationType='none'
            statusBarTranslucent
            onRequestClose={() => {
              setManageOpen(false);
              setConfirmAction(null);
            }}
          >
            <View style={styles.modalLayer} accessibilityViewIsModal>
              <Pressable
                style={StyleSheet.absoluteFillObject}
                onPress={() => {
                  setManageOpen(false);
                  setConfirmAction(null);
                }}
                accessibilityRole='button'
                accessibilityLabel='Close privacy controls'
              />
              <Entrance
                style={styles.managePanel}
                distance={reduceMotion ? 0 : 10}
                duration={210}
                initialOpacity={reduceMotion ? 1 : 0.9}
              >
                <View style={styles.manageHeading}>
                  <View style={styles.flex}>
                    <Text style={styles.manageTitle}>Your space with Meg</Text>
                    <Text style={styles.manageMeta}>
                      Privacy, context and conversation controls
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setManageOpen(false);
                      setConfirmAction(null);
                    }}
                    accessibilityRole='button'
                    accessibilityLabel='Close privacy controls'
                    style={({ pressed, focused }) => [
                      styles.closeButton,
                      focused && styles.interactiveFocus,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name='close' size={21} color={COLORS.ink} />
                  </Pressable>
                </View>

                <ScrollView
                  contentContainerStyle={styles.manageContent}
                  keyboardShouldPersistTaps='handled'
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.memoryRow}>
                    <View style={styles.memoryIcon}>
                      <Ionicons
                        name={memoryEnabled ? 'save-outline' : 'lock-closed-outline'}
                        size={18}
                        color={memoryEnabled ? COLORS.sage : COLORS.brand}
                      />
                    </View>
                    <View style={styles.memoryCopy}>
                      <Text style={styles.memoryTitle}>
                        {memoryEnabled ? 'Memory is on' : 'Memory is off'}
                      </Text>
                      <Text style={styles.memoryDescription}>
                        {memoryEnabled
                          ? 'Prior conversations can inform replies. Chats save securely to your account.'
                          : 'Prior conversations won’t inform replies. Chats still save securely to your account.'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleMemoryToggle(!memoryEnabled)}
                      disabled={savingMemory || typing}
                      accessibilityRole='switch'
                      accessibilityLabel='Allow Meg to remember conversations'
                      accessibilityHint='Controls whether prior conversations inform Meg replies'
                      accessibilityState={{ checked: memoryEnabled, disabled: savingMemory || typing }}
                      style={({ pressed }) => [
                        styles.switchTouch,
                        pressed && styles.pressed,
                        (savingMemory || typing) && styles.disabled,
                      ]}
                    >
                      <Switch
                        value={memoryEnabled}
                        accessible={false}
                        style={styles.nonInteractive}
                        trackColor={{ false: COLORS.hairline, true: COLORS.sageLight }}
                        thumbColor={memoryEnabled ? COLORS.sage : COLORS.white}
                      />
                    </Pressable>
                  </View>

                  <ContextPanel context={context} />

                  <View style={styles.safetyNote}>
                    <Ionicons name='shield-checkmark-outline' size={18} color={COLORS.sage} />
                    <Text style={styles.safetyNoteText}>
                      Meg supports reflection and small steps. It doesn’t replace medical or crisis care.
                    </Text>
                  </View>

                  {!confirmAction ? (
                    <View style={styles.manageActions}>
                      <Text style={styles.manageSectionLabel}>
                        {conversations.length} saved conversation{conversations.length === 1 ? '' : 's'}
                      </Text>
                      <Pressable
                        onPress={() => setConfirmAction('current')}
                        disabled={!hasConversation}
                        accessibilityRole='button'
                        accessibilityState={{ disabled: !hasConversation }}
                        style={({ pressed, hovered, focused }) => [
                          styles.manageAction,
                          styles.interactiveMotion,
                          hovered && styles.manageActionPressed,
                          focused && styles.interactiveFocus,
                          pressed && styles.manageActionPressed,
                          !hasConversation && styles.disabled,
                        ]}
                      >
                        <Ionicons name='trash-outline' size={18} color={COLORS.body} />
                        <Text style={styles.manageActionText}>Clear current conversation</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmAction('history')}
                        disabled={!conversations.length}
                        accessibilityRole='button'
                        accessibilityState={{ disabled: !conversations.length }}
                        style={({ pressed, hovered, focused }) => [
                          styles.manageAction,
                          styles.interactiveMotion,
                          hovered && styles.manageActionPressed,
                          focused && styles.interactiveFocus,
                          pressed && styles.manageActionPressed,
                          !conversations.length && styles.disabled,
                        ]}
                      >
                        <Ionicons name='albums-outline' size={18} color={COLORS.body} />
                        <Text style={styles.manageActionText}>Clear all saved history</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.confirmPanel}>
                      <Text style={styles.confirmText}>
                        {confirmAction === 'history'
                          ? 'Clear every saved Meg conversation from your Bloom account?'
                          : 'Clear this conversation from your Bloom account?'}
                      </Text>
                      <View style={styles.confirmButtons}>
                        <Pressable
                          onPress={() => setConfirmAction(null)}
                          disabled={clearingConversation}
                          accessibilityRole='button'
                          accessibilityState={{ disabled: clearingConversation }}
                          style={({ pressed, focused }) => [
                            styles.confirmButton,
                            focused && styles.interactiveFocus,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.confirmCancelText}>Keep it</Text>
                        </Pressable>
                        <Pressable
                          onPress={confirmClear}
                          disabled={clearingConversation}
                          accessibilityRole='button'
                          accessibilityState={{ disabled: clearingConversation, busy: clearingConversation }}
                          style={({ pressed, focused }) => [
                            styles.confirmButton,
                            styles.confirmDelete,
                            focused && styles.interactiveFocus,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.confirmDeleteText}>{clearingConversation ? 'Clearingâ€¦' : 'Clear'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </Entrance>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.surfaceWarm,
  },
  keyboardView: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.surfaceWarm,
  },
  shell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: MEG_SHELL_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.splash,
    ...Platform.select({
      web: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: COLORS.hairlineSoft,
      },
      default: {},
    }),
  },
  flex: { flex: 1 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  interactiveMotion: Platform.select({
    web: {
      cursor: 'pointer',
      transitionProperty: 'background-color, border-color, box-shadow, opacity, transform',
      transitionDuration: '170ms',
      transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
      outlineStyle: 'none',
    },
    default: {},
  }),
  interactiveHover: { backgroundColor: COLORS.surfaceSoft },
  interactiveFocus: Platform.select({ web: WEB_FOCUS, default: {} }),
  nonInteractive: { pointerEvents: 'none' },

  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairlineSoft,
    backgroundColor: COLORS.splash,
    zIndex: 20,
  },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerMark: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  headerCopy: { flex: 1, paddingRight: 8 },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.sage },
  subtitle: { fontSize: 12, lineHeight: 16, color: COLORS.muted },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  iconButtonHovered: { backgroundColor: COLORS.surfaceSoft },

  privacyLine: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: COLORS.splash,
  },
  privacyLineHovered: { backgroundColor: COLORS.surfaceSoft },
  privacyLinePressed: { opacity: 0.72 },
  privacyLineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.muted,
  },

  statusStack: { paddingHorizontal: 14, paddingTop: 6 },
  statusBanner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: LAYOUT.controlRadius,
  },
  offlineBanner: { backgroundColor: COLORS.surfaceWarm },
  errorBanner: { backgroundColor: '#FDF1EF' },
  statusText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.body },
  statusAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  statusActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brand,
    textDecorationLine: 'underline',
  },
  notice: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17, color: COLORS.body },

  scroll: { flex: 1, minHeight: 0 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },
  emptyScrollContent: { justifyContent: 'center' },
  conversationScrollContent: { paddingTop: 20, paddingBottom: 24 },

  welcome: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
  },
  welcomeAvatar: {
    width: 66,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
  },
  welcomeTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  welcomeBody: {
    maxWidth: 342,
    marginTop: 7,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.body,
    textAlign: 'center',
  },

  promptSection: { width: '100%', marginTop: 25 },
  promptLabel: {
    marginBottom: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: COLORS.muted,
    textAlign: 'center',
  },
  promptList: { gap: 8 },
  promptButton: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  promptHovered: { backgroundColor: COLORS.brandSoft },
  promptPressed: { backgroundColor: COLORS.brandSoft },
  promptText: { fontSize: 14, lineHeight: 20, color: COLORS.ink, textAlign: 'center' },

  modeSection: { width: '100%', alignItems: 'center', marginTop: 24 },
  modePrompt: {
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.body,
    textAlign: 'center',
  },
  modeRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  compactModeRow: { justifyContent: 'flex-start', paddingTop: 7 },
  modeChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 22,
    backgroundColor: COLORS.splash,
  },
  compactModeChip: { paddingHorizontal: 11 },
  modeChipHovered: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSoft },
  modeChipSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  modeChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.body,
    textAlign: 'center',
  },
  modeChipTextSelected: { color: COLORS.brand, fontWeight: '700' },
  firstUseSafety: {
    marginTop: 18,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.muted,
    textAlign: 'center',
  },

  messages: { gap: 20 },
  earlierMessages: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceSoft,
  },
  earlierMessagesText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLORS.brand },
  userMessageRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '78%',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomRightRadius: 5,
    backgroundColor: COLORS.brandSoft,
  },
  assistantMessageRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  megAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  safetyAvatar: { backgroundColor: COLORS.surfaceWarm },
  assistantColumn: { flexShrink: 1, width: '85%', maxWidth: '85%' },
  assistantName: {
    marginBottom: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.brand,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    paddingRight: 4,
  },
  safetyBubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceWarm,
  },
  messageText: { fontSize: 15, lineHeight: 23, color: COLORS.ink },
  deliveryStatus: { marginTop: 4, fontSize: 10.5, lineHeight: 15, color: COLORS.muted },
  deliveryStatusFailed: { color: COLORS.error },
  messageMetaRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageTime: { fontSize: 10.5, lineHeight: 15, color: COLORS.muted },
  userMessageTime: { marginTop: 4, textAlign: 'right' },
  copyButton: {
    minHeight: 34,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 5,
    borderRadius: 10,
  },
  copyLabel: { fontSize: 11, lineHeight: 15, color: COLORS.muted },
  feedbackRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 5,
  },
  feedbackLabel: { marginRight: 2, fontSize: 11, lineHeight: 16, color: COLORS.muted },
  feedbackButton: {
    minHeight: 44,
    minWidth: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  feedbackButtonSelected: { backgroundColor: COLORS.brandSoft },
  typingBubble: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.brand },
  typingText: { fontSize: 12, lineHeight: 17, color: COLORS.muted },

  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
    backgroundColor: COLORS.splash,
    zIndex: 30,
  },
  modeDock: { marginBottom: 7 },
  modeSummary: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 22,
  },
  modeSummaryHovered: { backgroundColor: COLORS.surfaceSoft },
  modeSummaryText: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: COLORS.body },
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    ...Platform.select({
      web: { boxShadow: 'rgba(44, 31, 33, 0.08) 0px 2px 8px' },
      ios: {
        shadowColor: '#2C1F21',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  composerFocused: { borderColor: COLORS.brand },
  composerLifted: { transform: [{ translateY: -1 }] },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 116,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 0,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.ink,
    ...Platform.select({ web: { outlineStyle: 'none' }, default: {} }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand,
  },
  sendButtonHovered: { backgroundColor: COLORS.brandHover },
  sendButtonDisabled: { backgroundColor: COLORS.surfaceSoft },

  modalLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(34, 34, 34, 0.22)',
  },
  managePanel: {
    width: '100%',
    maxWidth: 402,
    maxHeight: '88%',
    borderRadius: 16,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: 'rgba(34, 34, 34, 0.16) 0px 4px 8px' },
      ios: {
        shadowColor: '#222222',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  manageHeading: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairlineSoft,
  },
  manageTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: COLORS.ink },
  manageMeta: { marginTop: 2, fontSize: 12, lineHeight: 16, color: COLORS.muted },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  manageContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  memoryRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 14,
  },
  memoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSoft,
  },
  memoryCopy: { flex: 1, paddingRight: 4 },
  memoryTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink },
  memoryDescription: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },
  switchTouch: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextPanel: {
    padding: 14,
    marginBottom: 12,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  contextTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  contextIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  contextTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: COLORS.ink },
  contextBody: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.body },
  contextDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  contextChip: {
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: COLORS.white,
  },
  contextChipText: { fontSize: 11, lineHeight: 15, fontWeight: '600', color: COLORS.body },
  safetyNote: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.hairlineSoft,
  },
  safetyNoteText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.body },
  manageActions: { paddingTop: 14 },
  manageSectionLabel: {
    marginBottom: 5,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.muted,
  },
  manageAction: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: LAYOUT.controlRadius,
  },
  manageActionPressed: { backgroundColor: COLORS.surfaceSoft },
  manageActionText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLORS.body },
  confirmPanel: {
    marginTop: 14,
    padding: 14,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.surfaceWarm,
  },
  confirmText: { fontSize: 14, lineHeight: 20, color: COLORS.body },
  confirmButtons: { marginTop: 13, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmButton: {
    minHeight: 44,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.white,
  },
  confirmDelete: { borderColor: '#E8C8C4' },
  confirmCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  confirmDeleteText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});
