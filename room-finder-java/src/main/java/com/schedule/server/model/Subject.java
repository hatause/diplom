package com.schedule.server.model;

import jakarta.persistence.*;

import java.util.Objects;

@Entity
@Table(name = "subjects")
public class Subject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_sub")
    private Long idSub;

    @Column(name = "sub_name", nullable = false, unique = true)
    private String subName;

    @Column(name = "teacher_name", nullable = false)
    private String teacherName;

    public Subject() {}

    public Subject(String subName, String teacherName) {
        this.subName = subName;
        this.teacherName = teacherName;
    }

    public Long getIdSub() {
        return idSub;
    }

    public void setIdSub(Long idSub) {
        this.idSub = idSub;
    }

    public String getSubName() {
        return subName;
    }

    public void setSubName(String subName) {
        this.subName = subName;
    }

    public String getTeacherName() {
        return teacherName;
    }

    public void setTeacherName(String teacherName) {
        this.teacherName = teacherName;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Subject subject = (Subject) o;
        return Objects.equals(idSub, subject.idSub) &&
                Objects.equals(subName, subject.subName) &&
                Objects.equals(teacherName, subject.teacherName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idSub, subName, teacherName);
    }

    @Override
    public String toString() {
        return "Subject{" +
                "idSub=" + idSub +
                ", subName='" + subName + '\'' +
                ", teacherName='" + teacherName + '\'' +
                '}';
    }
}
