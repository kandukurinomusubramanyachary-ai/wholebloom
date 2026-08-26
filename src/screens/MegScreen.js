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
const { createMegRevealPlan } = require('../services/megReveal');

let idCounter = 0;

const MEG_SHELL_WIDTH = 430;
const PRIMARY_MODES = MEG_MODES.slice(0, 3).map((mode, index) => ({
  ...mode,
  label: ['Just listen', 'Help me understand', 'One small next step'][index],
  activeLabel: ['Just listening', 'Help me understand', 'One small next step'][index],
}));

const CONVERSATION_STARTERS = [
  {
    id: 'my-cycle',
    label: 'My cycle',
    text: 'Help me understand my cycle.',
    icon: 'water-outline',
    mode: null,
  },
  {
    id: 'food-cravings',
    label: 'Food & cravings',
    text: 'Can you help me think through food and cravings?',
    icon: 'restaurant-outline',
    mode: null,
  },
  {
    id: 'my-energy',
    label: 'Energy',
    text: 'I want to talk about my energy today.',
    icon: 'flash-outline',
    mode: null,
  },
  {
    id: 'my-mood',
    label: 'Mood',
    text: 'I want to talk about my mood.',
    icon: 'happy-outline',
    mode: null,
  },
];

const INITIAL_MESSAGE_COUNT = 30;

const WAITING_COPY = Object.freeze({
  listen: ['I’m here.', 'Taking in what you shared…'],
  understand: ['I’m here.', 'Looking at the details you shared…'],
  plan: ['I’m here.', 'Finding one small next step…'],
  conversation: ['I’m here.', 'Staying with the thread…'],
  doctor: ['I’m here.', 'Organising the details carefully…'],
  default: ['I’m here.', 'Taking in what you shared…'],
  still: ['Still with you.', 'Thinking about what matters most…'],
  care: ['Taking a little care.', 'Making this useful, not rushed.'],
});

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
      <Text style={styles.promptLabel}>Start with</Text>
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
            <View style={styles.promptIcon}>
              <Ionicons name={prompt.icon} size={18} color={COLORS.brand} />
            </View>
            <Text style={styles.promptText}>{prompt.label}</Text>
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
  const revealComplete = message.revealComplete !== false;
  const visibleText = revealComplete ? message.text : message.displayText;

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
          {revealComplete ? (
            <Text selectable accessibilityLiveRegion='polite' style={styles.messageText}>
              {message.text}
            </Text>
          ) : (
            <View accessibilityElementsHidden importantForAccessibility='no-hide-descendants'>
              <Text style={styles.messageText}>
                {visibleText}
                <Text style={styles.replyCursor}>▍</Text>
              </Text>
              <Text style={styles.replyingText}>Meg is replying…</Text>
            </View>
          )}
        </View>
        {revealComplete ? (
          <>
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
          </>
        ) : null}
      </View>
    </View>
  );
  return animate ? <Entrance distance={6} duration={230}>{bubble}</Entrance> : bubble;
}

function TypingBubble({ mode, stage = 0 }) {
  const reduceMotion = useReducedMotion();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.38))).current;
  const copy = stage >= 2
    ? WAITING_COPY.care
    : stage === 1
      ? WAITING_COPY.still
      : WAITING_COPY[mode] || WAITING_COPY.default;

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
          <View style={styles.waitingCopy}>
            <Text style={styles.waitingTitle}>{copy[0]}</Text>
            <Text style={styles.typingText}>{copy[1]}</Text>
          </View>
        </View>
      </View>
    </Entrance>
  );
}

function StatusBanner({ type, text, actionLabel, onAction, actionDisabled = false }) {
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
          disabled={actionDisabled}
          accessibilityRole='button'
          accessibilityState={{ disabled: actionDisabled }}
          style={({ pressed }) => [
            styles.statusAction,
            pressed && styles.pressed,
            actionDisabled && styles.disabled,
          ]}
        >
          <Text style={styles.statusActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MegScreen({ route, navigation }) {
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
  const recentConversations = useMemo(() => sortNewestFirst(conversations).slice(0, 4), [conversations]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMode, setSelectedMode] = useState(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [waitingStage, setWaitingStage] = useState(0);
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
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const waitingTimersRef = useRef([]);
  const revealTimerRef = useRef(null);
  const revealRunRef = useRef(0);
  const requestRunRef = useRef(0);
  const screenFocusedRef = useRef(true);

  function scrollLatestMessageIntoView() {
    scrollRef.current?.scrollTo({
      y: Math.max(0, latestMessageY.current + 20),
      animated: false,
    });
  }

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
  }, []);

  useEffect(() => {
    if (!manageOpen) {
      drawerProgress.setValue(0);
      return;
    }
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drawerProgress, manageOpen, reduceMotion]);

  useEffect(() => {
    if (!messages.length && !typing) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: !reduceMotion });
    }, 40);
    return () => clearTimeout(timer);
  }, [messages.length, reduceMotion, typing]);

  useEffect(() => {
    const unsubscribeBlur = navigation?.addListener?.('blur', () => {
      screenFocusedRef.current = false;
      clearWaitingTimers();
      cancelReveal(true);
    });
    const unsubscribeFocus = navigation?.addListener?.('focus', () => {
      screenFocusedRef.current = true;
    });
    return () => {
      unsubscribeBlur?.();
      unsubscribeFocus?.();
      screenFocusedRef.current = false;
      clearWaitingTimers();
      cancelReveal(false);
    };
  }, [navigation]);

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

  function clearWaitingTimers() {
    waitingTimersRef.current.forEach((timer) => clearTimeout(timer));
    waitingTimersRef.current = [];
  }

  function beginWaitingStages() {
    clearWaitingTimers();
    setWaitingStage(0);
    waitingTimersRef.current = [
      setTimeout(() => setWaitingStage(1), 1400),
      setTimeout(() => setWaitingStage(2), 4200),
    ];
  }

  function cancelReveal(completeVisibleReply = true) {
    revealRunRef.current += 1;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
    if (!completeVisibleReply) return;
    setMessages((current) => current.map((message) => (
      message.revealComplete === false
        ? { ...message, displayText: message.text, revealComplete: true }
        : message
    )));
  }

  function continueVerifiedReveal(messageId, frames, frameIndex = 1, runId = revealRunRef.current) {
    if (frameIndex >= frames.length || runId !== revealRunRef.current) return;
    const previousFrame = frames[frameIndex - 1];
    revealTimerRef.current = setTimeout(() => {
      if (runId !== revealRunRef.current) return;
      const frame = frames[frameIndex];
      const complete = frameIndex === frames.length - 1;
      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? { ...message, displayText: frame.text, revealComplete: complete }
          : message
      )));
      if (complete) {
        revealTimerRef.current = null;
        return;
      }
      continueVerifiedReveal(messageId, frames, frameIndex + 1, runId);
    }, previousFrame.delayMs);
  }

  function resetConversation(message = '') {
    requestRunRef.current += 1;
    clearWaitingTimers();
    cancelReveal(false);
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

  function closeDrawer() {
    setManageOpen(false);
    setConfirmAction(null);
  }

  function openConversation(conversation) {
    requestRunRef.current += 1;
    clearWaitingTimers();
    cancelReveal(false);
    const loadedMessages = conversation?.messages || [];
    const loadedMode = conversation?.mode || conversation?.supportMode || null;
    setCurrentConversationId(conversation.id);
    setMessages(loadedMessages);
    setVisibleMessageCount(INITIAL_MESSAGE_COUNT);
    setSelectedMode(loadedMode);
    setInput('');
    setNotice('');
    const recoverable = recoverableMegRequest(loadedMessages, conversation.id, loadedMode);
    setFailedRequest(recoverable);
    setError(recoverable ? 'Meg could not finish this reply.' : null);
    closeDrawer();
  }

  function navigateFromDrawer(routeName, nested = false) {
    closeDrawer();
    if (nested) {
      navigation.navigate(routeName);
      return;
    }
    navigation.getParent()?.navigate(routeName);
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
    const requestRunId = requestRunRef.current + 1;
    requestRunRef.current = requestRunId;
    cancelReveal(true);
    beginWaitingStages();
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
      const providerStartedAt = Date.now();
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
      const providerWaitMs = Date.now() - providerStartedAt;
      const requestIsCurrent = requestRunId === requestRunRef.current;
      if (requestIsCurrent) {
        clearWaitingTimers();
        setTyping(false);
      }
      const resolvedConversationId = result.conversationId || request.conversationId;
      const assistantMessage = {
        id: result.messageId || createId('meg-message'),
        role: 'assistant',
        text: result.text,
        createdAt: new Date().toISOString(),
        safety: result.safety || null,
        source: result.source || 'local',
        revealComplete: true,
      };
      const sentMessages = setMegMessageDelivery(
        pendingMessages,
        request.messageId,
        'sent'
      );
      const nextMessages = [...sentMessages, assistantMessage];
      const revealPlan = requestIsCurrent
        && screenFocusedRef.current
        && !reduceMotion
        && !result.urgent
        && !result.safety
        ? createMegRevealPlan(result.text, providerWaitMs)
        : [];
      const shouldReveal = revealPlan.length > 1;
      const presentedMessages = shouldReveal
        ? [
            ...sentMessages,
            {
              ...assistantMessage,
              displayText: revealPlan[0].text,
              revealComplete: false,
            },
          ]
        : nextMessages;
      if (requestIsCurrent) {
        setCurrentConversationId(resolvedConversationId);
        setMessages(presentedMessages);
      }
      if (qaTiming && requestIsCurrent) {
        requestAnimationFrame(() => qaTiming.markVisibleReply());
      }
      if (requestIsCurrent && shouldReveal) {
        revealRunRef.current += 1;
        continueVerifiedReveal(
          assistantMessage.id,
          revealPlan,
          1,
          revealRunRef.current
        );
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
      const requestIsCurrent = requestRunId === requestRunRef.current;
      if (requestIsCurrent) clearWaitingTimers();
      const failedMessages = setMegMessageDelivery(
        pendingMessages,
        request.messageId,
        'failed'
      );
      const retryRequest = { ...pendingRequest, baseMessages: failedMessages };
      if (requestIsCurrent) {
        setMessages(failedMessages);
        setError(
          requestError?.message
            || 'Meg couldn\'t respond right now. Please try again.'
        );
        setFailedRequest(retryRequest);
      }
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
      if (requestRunId === requestRunRef.current) {
        clearWaitingTimers();
        setTyping(false);
      }
      if (Platform.OS === 'web' && requestRunId === requestRunRef.current) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  }

  async function handleSend(overrideText, overrideMode) {
    const messageText = String(overrideText ?? input).trim();
    if (!messageText || typing || sendLockRef.current) return;
    clearWaitingTimers();
    cancelReveal(true);
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
    const completedMessages = messages.map((message) => (
      message.revealComplete === false
        ? { ...message, displayText: message.text, revealComplete: true }
        : message
    ));
    const baseMessages = [...completedMessages, userMessage];

    setCurrentConversationId(conversationId);
    setMessages(baseMessages);
    setSelectedMode(mode);
    setInput('');
    setModePickerOpen(false);
    setTyping(true);

    try {
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

  async function handleRetry() {
    if (!failedRequest || typing || sendLockRef.current) return;
    sendLockRef.current = true;
    try {
      await requestReply(failedRequest);
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
  const energyValue = context.todayCheckin?.energy;
  const hasLowEnergy = typeof energyValue === 'number'
    && Number.isFinite(energyValue)
    && energyValue <= 4;
  const contextNotice = hasLowEnergy
    ? {
        title: 'Low energy today',
        detail: 'Talk it through with Meg',
        prompt: 'My energy feels low today. Can we talk it through?',
      }
    : context.todayCheckin
      ? {
          title: 'Your check-in is ready',
          detail: 'Talk through what you logged',
          prompt: 'Can we talk through how I am feeling today?',
        }
      : context.currentPhase
        ? {
            title: `${context.currentPhase} support`,
            detail: 'Ask what might feel supportive today',
            prompt: `I am in the ${context.currentPhase} phase. What might support me today?`,
          }
        : {
            title: 'Need a place to start?',
            detail: 'Talk it through with Meg',
            prompt: 'I am not sure where to start. Can we talk it through?',
          };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.shell}>
          <View style={styles.header}>
            <Pressable
              onPress={() => setManageOpen(true)}
              disabled={typing}
              accessibilityRole='button'
              accessibilityLabel='Open Meg menu'
              accessibilityState={{ expanded: manageOpen, disabled: typing }}
              style={({ pressed, focused }) => [
                styles.menuButton,
                focused && styles.interactiveFocus,
                pressed && styles.pressed,
                typing && styles.disabled,
              ]}
            >
              <Ionicons name='time-outline' size={22} color={COLORS.muted} />
            </Pressable>
            <View style={styles.centeredHeaderTitle} pointerEvents='none'>
              <Text style={styles.title}>Meg</Text>
            </View>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('Profile')}
              accessibilityRole='button'
              accessibilityLabel='Open your profile'
              style={({ pressed, hovered, focused }) => [
                styles.menuButton,
                hovered && styles.iconButtonHovered,
                focused && styles.interactiveFocus,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name='person-circle-outline' size={23} color={COLORS.muted} />
            </Pressable>
          </View>

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
                  <View style={styles.welcomeCopy}>
                    <Text style={styles.welcomeTitle}>What&apos;s on your mind?</Text>
                    <Text style={styles.welcomeBody}>Cycle, cravings, energy, or just today.</Text>
                  </View>

                  <View
                    style={[
                      styles.composer,
                      styles.inlineComposer,
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
                      placeholder='Ask Meg anything...'
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
                        size={20}
                        color={input.trim() && !typing ? COLORS.onBrand : COLORS.muted}
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() => handleSend(contextNotice.prompt)}
                    disabled={typing}
                    accessibilityRole='button'
                    accessibilityLabel={`${contextNotice.title}. ${contextNotice.detail}`}
                    accessibilityState={{ disabled: typing }}
                    style={({ pressed, hovered, focused }) => [
                      styles.contextNotice,
                      styles.interactiveMotion,
                      hovered && styles.contextNoticeHovered,
                      focused && styles.interactiveFocus,
                      pressed && styles.contextNoticePressed,
                      typing && styles.disabled,
                    ]}
                  >
                    <View style={styles.contextNoticeIcon}>
                      <Ionicons name='sparkles-outline' size={15} color={COLORS.brand} />
                    </View>
                    <View style={styles.contextNoticeCopy}>
                      <Text style={styles.contextNoticeTitle}>{contextNotice.title}</Text>
                      <Text style={styles.contextNoticeDetail}>{contextNotice.detail}</Text>
                    </View>
                    <Ionicons name='arrow-forward' size={17} color={COLORS.muted} />
                  </Pressable>

                  <ConversationStarters
                    disabled={typing}
                    onSelect={(prompt) => handleSend(prompt.text, prompt.mode)}
                  />
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
                {typing ? <TypingBubble mode={selectedMode} stage={waitingStage} /> : null}
                {error && failedRequest ? (
                  <StatusBanner
                    type='error'
                    text={requestErrorText}
                    actionLabel='Try again'
                    onAction={handleRetry}
                    actionDisabled={typing}
                  />
                ) : null}
              </View>
            )}
          </ScrollView>

          {hasConversation ? (
            <View style={styles.composerWrap}>
            {hasConversation || modePickerOpen ? (
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
              <Pressable
                onPress={() => setModePickerOpen((value) => !value)}
                accessibilityRole='button'
                accessibilityLabel='Choose how Meg should support you'
                style={({ pressed, focused }) => [
                  styles.addButton,
                  focused && styles.interactiveFocus,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name='add' size={23} color={COLORS.ink} />
              </Pressable>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                editable={!typing}
                multiline
                maxLength={600}
                placeholder='Ask Meg anything...'
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
                  color={input.trim() && !typing ? COLORS.onBrand : COLORS.muted}
                />
              </Pressable>
            </View>
            </View>
          ) : null}

          <Modal
            visible={manageOpen}
            transparent
            animationType='none'
            statusBarTranslucent
            onRequestClose={closeDrawer}
          >
            <View style={styles.drawerModalLayer} accessibilityViewIsModal>
              <Pressable
                style={styles.drawerScrim}
                onPress={closeDrawer}
                accessibilityRole='button'
                accessibilityLabel='Close Meg menu'
              />
              <Animated.View
                style={[
                  styles.drawer,
                  !reduceMotion && {
                    transform: [{
                      translateX: drawerProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-330, 0],
                      }),
                    }],
                  },
                ]}
              >
                <View style={styles.drawerHeader}>
                  <Text style={styles.drawerBrand}>Bloom</Text>
                  <Pressable
                    onPress={closeDrawer}
                    accessibilityRole='button'
                    accessibilityLabel='Close Meg menu'
                    style={({ pressed }) => [styles.drawerIconButton, pressed && styles.drawerPressed]}
                  >
                    <Ionicons name='close' size={26} color='#F3F0EE' />
                  </Pressable>
                </View>

                <View style={styles.newChatWrap}>
                  <Pressable
                    onPress={() => resetConversation('')}
                    disabled={typing}
                    accessibilityRole='button'
                    style={({ pressed }) => [styles.newChatButton, pressed && styles.drawerPressed]}
                  >
                    <Ionicons name='add' size={19} color={COLORS.onBrand} />
                    <Text style={styles.newChatText}>New chat</Text>
                  </Pressable>
                </View>

                <View style={styles.drawerNav}>
                  {[
                    { label: 'Chats', icon: 'chatbubble-outline', active: true, onPress: closeDrawer },
                    { label: 'Doctor report', icon: 'document-text-outline', onPress: () => navigateFromDrawer('DoctorReport') },
                    { label: 'Health logs', icon: 'shield-checkmark-outline', onPress: () => navigateFromDrawer('Timeline', true) },
                  ].map((item) => (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      accessibilityRole='button'
                      style={({ pressed }) => [styles.drawerNavItem, pressed && styles.drawerPressed]}
                    >
                      <Ionicons name={item.icon} size={22} color={item.active ? '#F3F0EE' : '#BDB8B6'} />
                      <Text style={[styles.drawerNavText, !item.active && styles.drawerMutedText]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <ScrollView style={styles.drawerRecentScroll} contentContainerStyle={styles.recentList} showsVerticalScrollIndicator={false}>
                  <Text style={styles.recentLabel}>RECENT</Text>
                  {recentConversations.length ? recentConversations.map((conversation) => {
                    const active = conversation.id === currentConversationId;
                    return (
                      <Pressable
                        key={conversation.id}
                        onPress={() => openConversation(conversation)}
                        accessibilityRole='button'
                        style={({ pressed }) => [
                          styles.recentItem,
                          active && styles.recentItemActive,
                          pressed && styles.drawerPressed,
                        ]}
                      >
                        <Text numberOfLines={1} style={[styles.recentText, active && styles.recentTextActive]}>
                          {conversation.title || 'Conversation with Meg'}
                        </Text>
                      </Pressable>
                    );
                  }) : (
                    <Text style={styles.emptyRecent}>Your recent chats will appear here.</Text>
                  )}
                </ScrollView>

                <View style={styles.drawerProfile}>
                  <Pressable
                    onPress={() => navigateFromDrawer('Profile')}
                    accessibilityRole='button'
                    style={({ pressed }) => [styles.profileIdentity, pressed && styles.drawerPressed]}
                  >
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileInitial}>
                        {String(state.profile?.preferredName || state.profile?.name || 'You').trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.profileName}>
                      {state.profile?.preferredName || state.profile?.name || 'Your profile'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigateFromDrawer('Preferences')}
                    accessibilityRole='button'
                    accessibilityLabel='Open settings'
                    style={({ pressed }) => [styles.drawerIconButton, pressed && styles.drawerPressed]}
                  >
                    <Ionicons name='settings-outline' size={21} color='#BDB8B6' />
                  </Pressable>
                </View>
              </Animated.View>
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
    backgroundColor: COLORS.canvas,
  },
  keyboardView: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
  },
  shell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: MEG_SHELL_WIDTH,
    alignSelf: 'center',
    backgroundColor: COLORS.canvas,
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
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.canvas,
    zIndex: 20,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredHeaderTitle: {
    position: 'absolute',
    left: 64,
    right: 64,
    alignItems: 'center',
  },
  headerSpacer: { width: 44, height: 44 },
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
    fontSize: 17,
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
  errorBanner: { backgroundColor: COLORS.surfaceWarm },
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  emptyScrollContent: { justifyContent: 'flex-start' },
  conversationScrollContent: { paddingTop: 20, paddingBottom: 24 },

  welcome: {
    alignItems: 'stretch',
    width: '100%',
    paddingTop: 4,
    paddingBottom: 4,
  },
  welcomeCopy: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: COLORS.hairlineSoft,
    borderRadius: 18,
    backgroundColor: COLORS.ivory,
  },
  welcomeTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  welcomeBody: {
    maxWidth: 390,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
    textAlign: 'center',
  },
  quickLinks: {
    maxWidth: 390,
    marginTop: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickLink: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 1, borderRadius: 4 },
  quickLinkPressed: { opacity: 0.58 },
  quickLinkText: { fontSize: 14, lineHeight: 20, color: '#5F5E5E' },
  quickLinkDivider: { fontSize: 14, lineHeight: 20, color: '#E5E2E0' },
  suggestionList: { width: '100%', gap: 16, marginTop: 56 },
  suggestionOuter: { width: '100%', padding: 8, borderRadius: 22 },
  suggestionHovered: { transform: [{ scale: 0.99 }] },
  suggestionPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  suggestionCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.10)' },
      ios: { shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  suggestionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  suggestionText: { flex: 1, fontSize: 16, lineHeight: 24, color: '#1B1C1B' },

  contextNotice: {
    width: '100%',
    minHeight: 56,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  contextNoticeHovered: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },
  contextNoticePressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  contextNoticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  contextNoticeCopy: { flex: 1, minWidth: 0 },
  contextNoticeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  contextNoticeDetail: { fontSize: 11, lineHeight: 16, color: COLORS.muted },

  promptSection: { width: '100%', marginTop: 24 },
  promptLabel: {
    marginBottom: 10,
    paddingHorizontal: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: COLORS.ink,
  },
  promptList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptButton: {
    width: '47%',
    flexGrow: 1,
    minHeight: 88,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  promptHovered: { borderColor: COLORS.borderStrong, backgroundColor: COLORS.surfaceSoft },
  promptPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  promptIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  promptText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.ink },

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
  replyCursor: { color: COLORS.brand, fontWeight: '700' },
  replyingText: { marginTop: 7, fontSize: 11, lineHeight: 16, color: COLORS.muted },
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
  waitingCopy: { flex: 1, minWidth: 0 },
  waitingTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: COLORS.ink },
  typingText: { fontSize: 12, lineHeight: 17, color: COLORS.muted },

  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
    backgroundColor: COLORS.canvas,
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
    gap: 6,
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
      ios: {
        shadowColor: '#2C1F21',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  inlineComposer: { width: '100%', marginTop: 18 },
  composerFocused: { borderColor: COLORS.brand },
  composerLifted: { transform: [{ translateY: -1 }] },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 116,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    lineHeight: 20,
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceStrong,
  },
  sendButtonHovered: { backgroundColor: COLORS.brandHover },
  sendButtonDisabled: { backgroundColor: COLORS.surfaceSoft },

  drawerModalLayer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.scrim,
  },
  drawerScrim: { ...StyleSheet.absoluteFillObject },
  drawer: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: '#2A2726',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '4px 0 18px rgba(0,0,0,0.22)' },
      ios: { shadowColor: '#000000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.22, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  drawerHeader: {
    minHeight: 82,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerBrand: { fontSize: 16, lineHeight: 20, fontWeight: '600', color: '#F3F0EE' },
  drawerIconButton: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  drawerPressed: { opacity: 0.68 },
  newChatWrap: { paddingHorizontal: 24, paddingBottom: 16 },
  newChatButton: {
    minHeight: 58,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.brand,
  },
  newChatText: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: COLORS.onBrand },
  drawerNav: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  drawerNavItem: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  drawerNavText: { fontSize: 16, lineHeight: 24, color: '#F3F0EE' },
  drawerMutedText: { color: '#BDB8B6' },
  drawerRecentScroll: { flex: 1, minHeight: 0 },
  recentList: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 18, gap: 6 },
  recentLabel: { marginBottom: 2, fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#888382', letterSpacing: 0.5 },
  recentItem: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8 },
  recentItemActive: { backgroundColor: '#F7F7F7' },
  recentText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#D4CFCD' },
  recentTextActive: { color: '#2A2726' },
  emptyRecent: { paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, lineHeight: 19, color: '#888382' },
  drawerProfile: {
    minHeight: 76,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileIdentity: { minHeight: 54, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: '#514A48',
  },
  profileInitial: { fontSize: 14, fontWeight: '700', color: '#F3F0EE' },
  profileName: { flex: 1, fontSize: 14, lineHeight: 20, color: '#F3F0EE' },
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
