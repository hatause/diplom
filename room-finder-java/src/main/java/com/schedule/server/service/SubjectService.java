package com.schedule.server.service;

import com.schedule.server.db.SubjectRepository;
import com.schedule.server.model.Subject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.List;

@Service
public class SubjectService {
    private final SubjectRepository subjectRepository;

    public SubjectService(SubjectRepository subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    /**
     * Добавляет предмет и преподавателя. Если предмет уже есть,
     * добавляет преподавателя через запятую (без дублирования).
     */
    @Transactional
    public void addOrUpdateSubject(String subName, String teacherName) {
        if (subName == null || subName.isBlank()) return;

        Optional<Subject> subjectOpt = subjectRepository.findBySubName(subName.trim());
        // Normalize incoming teacher names: split by comma, trim, remove empty and duplicates preserving order
        String incoming = teacherName == null ? "" : teacherName;
        String[] incomingParts = incoming.split(",");

        if (subjectOpt.isPresent()) {
            Subject subject = subjectOpt.get();
            // Use LinkedHashMap to preserve insertion order and keep original casing of first occurrence
            java.util.Map<String, String> unique = new java.util.LinkedHashMap<>();

            // existing teachers
            String existing = subject.getTeacherName() == null ? "" : subject.getTeacherName();
            for (String part : existing.split(",")) {
                String t = part == null ? "" : part.trim();
                if (t.isEmpty()) continue;
                String key = t.toLowerCase();
                unique.putIfAbsent(key, t);
            }

            // incoming teachers (may contain duplicates within cell)
            for (String part : incomingParts) {
                String t = part == null ? "" : part.trim();
                if (t.isEmpty()) continue;
                String key = t.toLowerCase();
                unique.putIfAbsent(key, t);
            }

            String joined = String.join(", ", unique.values());
            if (!joined.equals(existing)) {
                subject.setTeacherName(joined);
                subjectRepository.save(subject);
            }
        } else {
            // new subject: dedupe incoming names
            java.util.Map<String, String> unique = new java.util.LinkedHashMap<>();
            for (String part : incomingParts) {
                String t = part == null ? "" : part.trim();
                if (t.isEmpty()) continue;
                unique.putIfAbsent(t.toLowerCase(), t);
            }
            String joined = String.join(", ", unique.values());
            Subject subject = new Subject(subName.trim(), joined);
            subjectRepository.save(subject);
        }
    }

    /**
     * Возвращает все предметы.
     */
    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }
}
