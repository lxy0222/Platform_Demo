import { expect } from "@playwright/test";
import { test } from "./fixture";

test.beforeEach(async ({ page }) => {
  page.setViewportSize({ width: 1280, height: 768 });
  await page.goto("https://www.example.com");
  await page.waitForLoadState("networkidle");
});

test("示例测试 - 验证页面标题", async ({ 
  ai, 
  aiQuery, 
  aiAssert,
  aiInput,
  aiTap,
  aiScroll,
  aiWaitFor,
  aiHover,
  aiKeyboardPress
}) => {
  // 等待页面加载完成
  await aiWaitFor('页面完全加载');
  
  // 验证页面标题
  await aiAssert('页面标题包含 "Example Domain"');
  
  // 使用Playwright原生断言
  await expect(page).toHaveTitle(/Example Domain/);
  
  console.log('✅ 示例测试完成');
});
