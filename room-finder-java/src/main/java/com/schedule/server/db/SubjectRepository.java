package com.schedule.server.db;

import com.schedule.server.model.Subject;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.util.List;
import java.util.Optional;

@Repository
public class SubjectRepository {

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate namedJdbc;

    public SubjectRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.namedJdbc = new NamedParameterJdbcTemplate(jdbc);
    }

    private static final RowMapper<Subject> ROW_MAPPER = (ResultSet rs, int rowNum) -> {
        Subject s = new Subject();
        s.setSubName(rs.getString("sub_name"));
        s.setTeacherName(rs.getString("teacher_name"));
        long id = rs.getLong("id_sub");
        if (!rs.wasNull()) {
            s.setIdSub(id);
        }
        return s;
    };

    public List<Subject> findAll() {
        return jdbc.query("SELECT id_sub, sub_name, teacher_name FROM subjects ORDER BY sub_name", ROW_MAPPER);
    }

    public Optional<Subject> findBySubName(String subName) {
        List<Subject> list = jdbc.query(
                "SELECT id_sub, sub_name, teacher_name FROM subjects WHERE sub_name = ?",
                ROW_MAPPER, subName);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Subject save(Subject subject) {
        if (subject.getIdSub() == null) {
            // insert
            KeyHolder keyHolder = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                java.sql.PreparedStatement ps = connection.prepareStatement(
                        "INSERT INTO subjects (sub_name, teacher_name) VALUES (?, ?)",
                        new String[]{"id_sub"}
                );
                ps.setString(1, subject.getSubName());
                ps.setString(2, subject.getTeacherName());
                return ps;
            }, keyHolder);
            Number key = keyHolder.getKey();
            if (key != null) {
                try {
                    java.lang.reflect.Field f = Subject.class.getDeclaredField("idSub");
                    f.setAccessible(true);
                    f.set(subject, key.longValue());
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
            return subject;
        } else {
            // update
            jdbc.update("UPDATE subjects SET sub_name = ?, teacher_name = ? WHERE id_sub = ?",
                    subject.getSubName(), subject.getTeacherName(), subject.getIdSub());
            return subject;
        }
    }
}
