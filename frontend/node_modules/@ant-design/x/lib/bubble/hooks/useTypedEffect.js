"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard").default;
var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault").default;
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _useLayoutEffect = _interopRequireDefault(require("rc-util/lib/hooks/useLayoutEffect"));
var React = _interopRequireWildcard(require("react"));
function isString(str) {
  return typeof str === 'string';
}

/**
 * Return typed content and typing status when typing is enabled.
 * Or return content directly.
 */
const useTypedEffect = (content, typingEnabled, typingStep, typingInterval) => {
  const prevContentRef = React.useRef('');
  const [typingIndex, setTypingIndex] = React.useState(1);
  const mergedTypingEnabled = typingEnabled && isString(content);

  // Reset typing index when content changed
  (0, _useLayoutEffect.default)(() => {
    if (!mergedTypingEnabled && isString(content)) {
      setTypingIndex(content.length);
    } else if (isString(content) && isString(prevContentRef.current) && content.indexOf(prevContentRef.current) !== 0) {
      setTypingIndex(1);
    }
    prevContentRef.current = content;
  }, [content]);

  // Start typing
  React.useEffect(() => {
    if (mergedTypingEnabled && typingIndex < content.length) {
      const id = setTimeout(() => {
        setTypingIndex(prev => prev + typingStep);
      }, typingInterval);
      return () => {
        clearTimeout(id);
      };
    }
  }, [typingIndex, typingEnabled, content]);
  const mergedTypingContent = mergedTypingEnabled ? content.slice(0, typingIndex) : content;
  return [mergedTypingContent, mergedTypingEnabled && typingIndex < content.length];
};
var _default = exports.default = useTypedEffect;