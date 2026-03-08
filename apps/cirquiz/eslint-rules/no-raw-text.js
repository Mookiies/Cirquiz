/**
 * ESLint rule: no-raw-text
 * Disallows raw string literals rendered as React children.
 * All user-facing text must go through t() for localization.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw text as React children; use t() for localization',
    },
    messages: {
      noRawText: 'Text "{{text}}" must be localized using t()',
    },
  },
  create(context) {
    function hasLetters(text) {
      return /[a-zA-Z]/.test(text);
    }

    return {
      JSXText(node) {
        if (hasLetters(node.value)) {
          context.report({
            node,
            messageId: 'noRawText',
            data: { text: node.value.trim() },
          });
        }
      },

      JSXExpressionContainer(node) {
        // Skip attribute values like prop={'value'} — only flag JSX children
        if (node.parent && node.parent.type === 'JSXAttribute') return;

        const { expression } = node;

        if (expression.type === 'Literal' && typeof expression.value === 'string') {
          if (hasLetters(expression.value)) {
            context.report({
              node,
              messageId: 'noRawText',
              data: { text: expression.value },
            });
          }
        }

        if (expression.type === 'TemplateLiteral') {
          const rawText = expression.quasis.map((q) => q.value.cooked ?? q.value.raw).join('');
          if (hasLetters(rawText)) {
            context.report({
              node,
              messageId: 'noRawText',
              data: { text: rawText },
            });
          }
        }
      },
    };
  },
};
