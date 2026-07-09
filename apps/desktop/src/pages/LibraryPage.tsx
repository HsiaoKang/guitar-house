/**
 * 课程库页
 *
 * 应用首页：课程卡片列表（含学习进度），支持从文件夹导入课程
 * （默认整理规则：子文件夹归纳为课节）、重新扫描、删除课程。
 */
import { useState } from "react";
import { BrandLogo, Button, EmptyState, IconButton, Modal, ProgressBar } from "@learning-house/ui";
import { COURSE_TYPE_LABELS, type Course, type CourseType } from "../types";
import { brand, brandName, topBar } from "../styles/layout.css";
import {
  courseCard,
  courseCardActions,
  courseCardHead,
  courseGrid,
  courseMeta,
  courseName,
  courseProgressLabel,
  courseTypeTag,
  importActions,
  importHint,
  importTypeBtn,
  libraryBody,
} from "./library.css";
import { appShell } from "../styles/layout.css";

interface LibraryPageProps {
  courses: Course[];
  /** 进入某课程的上课页 */
  onOpenCourse: (id: string) => void;
  /** 选择文件夹导入课程（type 为课程类型） */
  onImportFolder: (type: CourseType) => void;
  /** 重新扫描课程根文件夹（保留完成状态） */
  onRescanCourse: (id: string) => void;
  /** 删除课程（仅移出课程库，不动磁盘文件） */
  onDeleteCourse: (id: string) => void;
  /** 主题切换按钮（由 App 注入，含图标与行为） */
  themeToggle: React.ReactNode;
}

/**
 * 计算课程学习进度
 *
 * @param course 课程
 * @returns 已完成课节数与总课节数
 */
function progressOf(course: Course): { done: number; total: number } {
  const total = course.lessons.length;
  const done = course.lessons.filter((l) => l.completed).length;
  return { done, total };
}

/**
 * 课程库页组件
 *
 * @param props 见 LibraryPageProps 字段说明
 */
export function LibraryPage(props: LibraryPageProps) {
  const { courses, onOpenCourse, onImportFolder, onRescanCourse, onDeleteCourse, themeToggle } = props;
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className={appShell}>
      <header className={topBar}>
        <div className={brand}>
          <BrandLogo />
          <span className={brandName}>Learning House</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {themeToggle}
          <Button variant="primary" icon="plus" onClick={() => setImportOpen(true)}>
            导入课程文件夹
          </Button>
        </div>
      </header>

      <main className={libraryBody}>
        {courses.length === 0 ? (
          <EmptyState
            icon="folderOpen"
            title="还没有课程"
            hint="选择一个文件夹，其中的每个子文件夹会自动归纳为一节课"
          >
            <Button variant="primary" onClick={() => setImportOpen(true)}>
              导入课程文件夹
            </Button>
          </EmptyState>
        ) : (
          <div className={courseGrid}>
            {courses.map((course) => {
              const { done, total } = progressOf(course);
              const percent = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={course.id} className={courseCard} onClick={() => onOpenCourse(course.id)}>
                  <div className={courseCardHead}>
                    <span className={courseName} title={course.name}>
                      {course.name}
                    </span>
                    <span className={courseTypeTag}>{COURSE_TYPE_LABELS[course.type]}</span>
                  </div>
                  <div className={courseMeta}>
                    {total} 课节 · 已完成 {done} 节
                  </div>
                  <ProgressBar percent={percent} />
                  <div className={courseProgressLabel}>{percent}%</div>
                  <div className={courseCardActions} onClick={(e) => e.stopPropagation()}>
                    {course.rootDir && (
                      <IconButton
                        name="rescan"
                        label="按文件夹重新扫描课节"
                        onClick={() => onRescanCourse(course.id)}
                      />
                    )}
                    <IconButton
                      name="trash"
                      label="删除课程"
                      onClick={() => {
                        if (confirm(`确认从课程库删除「${course.name}」？磁盘文件不会被删除。`)) {
                          onDeleteCourse(course.id);
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="导入课程" width="360px">
        <p className={importHint}>选择课程类型后挑选课程根文件夹，子文件夹将自动归纳为课节。</p>
        <div className={importActions}>
          {(Object.keys(COURSE_TYPE_LABELS) as CourseType[]).map((type) => (
            <Button
              key={type}
              variant="primary"
              className={importTypeBtn}
              onClick={() => {
                setImportOpen(false);
                onImportFolder(type);
              }}
            >
              {COURSE_TYPE_LABELS[type]}课程
            </Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
